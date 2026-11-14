export type BlockKind = 'lowpass' | 'normalize' | 'krzywa_erd' | 'mapa_erd';

export type Etap = 'wstepne' | 'wyniki';

export type LowpassParams = {
  cutoffHz: number;
  order: number;
};

export type NormalizeParams = {
  method: 'zscore' | 'minmax';
};

export type StftParams = {
  windowSize: number;
  overlap: number;
};

export type Zakres = {
  fMin: number;
  fMax: number;
};

export type PipelineNodeData =
  | {
      kind: 'start';
      label: string;
    }
  | {
      kind: 'stft';
      label: string;
      params: StftParams;
    }
  | {
      kind: 'lowpass';
      label: string;
      params: LowpassParams;
    }
  | {
      kind: 'normalize';
      label: string;
      params: NormalizeParams;
    }
  | {
      kind: 'krzywa_erd';
      label: string;
      params: Zakres;
    }
  | {
      kind: 'mapa_erd';
      label: string;
      params: Zakres;
    };
