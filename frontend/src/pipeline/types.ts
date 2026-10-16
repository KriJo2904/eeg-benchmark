export type BlockKind = 'lowpass' | 'fft' | 'normalize';

export type LowpassParams = {
  cutoffHz: number;
  order: number;
};

export type FftParams = {
  windowSize: number;
  overlap: number;
};

export type NormalizeParams = {
  method: 'zscore' | 'minmax';
};

export type BlockParamsByKind = {
  lowpass: LowpassParams;
  fft: FftParams;
  normalize: NormalizeParams;
};

export type PipelineNodeData =
  | {
      kind: 'start';
      label: string;
    }
  | {
      kind: 'end';
      label: string;
    }
  | {
      kind: 'lowpass';
      label: string;
      params: LowpassParams;
    }
  | {
      kind: 'fft';
      label: string;
      params: FftParams;
    }
  | {
      kind: 'normalize';
      label: string;
      params: NormalizeParams;
    };
