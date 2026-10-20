import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

const PORT = Number(process.env.PORT || 3000);
const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/eeg_workspace';

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dataSelection: mongoose.Schema.Types.Mixed,
    pipeline: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

const Project = mongoose.model('Project', ProjectSchema);

const AnalysisDocSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    kind: { type: String, required: true },
    key: { type: String, default: '' },
    data: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true },
);

const AnalysisDoc = mongoose.model('AnalysisDoc', AnalysisDocSchema);

function csvLine(values) {
  return values
    .map((v) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',') + '\n';
}

async function main() {
  await mongoose.connect(MONGO_URL);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '200mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.get('/projects', async (_req, res) => {
    const projects = await Project.find({}).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ projects });
  });

  app.post('/projects', async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).send('name is required');
    const project = await Project.create({ name });
    res.status(201).json({ project });
  });

  app.get('/projects/:id', async (req, res) => {
    const project = await Project.findById(req.params.id).lean();
    if (!project) return res.status(404).send('not found');
    res.json({ project });
  });

  app.patch('/projects/:id', async (req, res) => {
    const patch = req.body || {};
    const $set = {};
    if (patch.name !== undefined) $set.name = String(patch.name).trim();
    if (patch.dataSelection !== undefined) $set.dataSelection = patch.dataSelection;
    if (patch.pipeline !== undefined) $set.pipeline = patch.pipeline;
    const project = await Project.findByIdAndUpdate(req.params.id, { $set }, { new: true }).lean();
    if (!project) return res.status(404).send('not found');
    res.json({ project });
  });

  app.put('/projects/:id/analysis', async (req, res) => {
    const { summary, subjects, maps } = req.body || {};
    if (!summary) return res.status(400).send('summary is required');
    const projectId = req.params.id;

    const docs = [{ projectId, kind: 'summary', key: 'summary', data: summary }];
    for (const s of subjects || []) docs.push({ projectId, kind: 'subject', key: s.subjectId, data: s.data });
    for (const m of maps || []) {
      docs.push({ projectId, kind: 'map', key: `${m.task}|${m.event}`, data: { epochs: m.epochs, data: m.data } });
    }

    await AnalysisDoc.deleteMany({ projectId });
    await AnalysisDoc.insertMany(docs);
    res.json({ ok: true, documents: docs.length });
  });

  app.get('/projects/:id/analysis', async (req, res) => {
    const doc = await AnalysisDoc.findOne({ projectId: req.params.id, kind: 'summary' }).lean();
    if (!doc) return res.status(404).send('Brak wyniku analizy dla tego projektu');
    res.json({ summary: doc.data, createdAt: doc.createdAt });
  });

  app.get('/projects/:id/analysis/subjects/:subjectId', async (req, res) => {
    const doc = await AnalysisDoc.findOne({
      projectId: req.params.id,
      kind: 'subject',
      key: req.params.subjectId,
    }).lean();
    if (!doc) return res.status(404).send('Brak wyniku dla tego badanego');
    res.json({ subjectId: doc.key, data: doc.data });
  });

  app.get('/projects/:id/analysis/maps/:task/:event', async (req, res) => {
    const doc = await AnalysisDoc.findOne({
      projectId: req.params.id,
      kind: 'map',
      key: `${req.params.task}|${req.params.event}`,
    }).lean();
    if (!doc) return res.status(404).send('Brak mapy dla tego zadania i zdarzenia');
    res.json(doc.data);
  });

  app.get('/projects/:id/analysis.csv', async (req, res) => {
    const projectId = req.params.id;
    const summary = await AnalysisDoc.findOne({ projectId, kind: 'summary' }).lean();
    if (!summary) return res.status(404).send('Brak wyniku analizy dla tego projektu');
    const time = summary.data.time || [];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="analiza_${projectId}.csv"`);
    res.write(csvLine(['badany', 'zadanie', 'zdarzenie', 'elektroda', 'czas_s', 'erd_proc']));

    const cursor = AnalysisDoc.find({ projectId, kind: 'subject' }).sort({ key: 1 }).lean().cursor();
    for await (const doc of cursor) {
      for (const [task, events] of Object.entries(doc.data || {})) {
        for (const [event, value] of Object.entries(events)) {
          for (const [channel, erd] of Object.entries(value.erd || {})) {
            let chunk = '';
            erd.forEach((x, i) => {
              chunk += csvLine([doc.key, task, event, channel, time[i], x]);
            });
            res.write(chunk);
          }
        }
      }
    }
    res.end();
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`projects-api listening on :${PORT}`);
  });
}

main().catch((e) => {
  console.error('fatal', e);
  process.exit(1);
});

