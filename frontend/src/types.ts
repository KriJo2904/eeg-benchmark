export type RecordRef = {
  id: string;
  path: string;
};

export type SubjectsResponse = {
  subjects: string[];
};

export type SubjectRecordsResponse = {
  subject: string;
  records: RecordRef[];
};

export type ChannelInfo = {
  index: number;
  label: string;
  unit: string;
  sampleRateHz: number;
};

export type RecordMetadata = {
  id: string;
  durationSec: number;
  signalsInFile: number;
  hasAnnotations: boolean;
  channels: ChannelInfo[];
};

export type SignalWindow = {
  id: string;
  channel: string;
  t0: number;
  sampleRateHz: number;
  decimate: number;
  samples: number[];
};

export type EventItem = {
  onsetSec: number;
  durationSec: number;
  description: string;
};

export type EventsResponse = {
  id: string;
  events: EventItem[];
};
