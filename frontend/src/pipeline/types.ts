export type BlockKind = 'lowpass' | 'fft' | 'normalize' | 'spektrogram' | 'band_power';

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

export type SpektrogramParams = {
  fMin: number;
  fMax: number;
};

export type BandPowerParams = {
  fMin: number;
  fMax: number;
  agg: 'mean' | 'sum';
};

export type BlockParamsByKind = {
  lowpass: LowpassParams;
  fft: FftParams;
  normalize: NormalizeParams;
  spektrogram: SpektrogramParams;
  band_power: BandPowerParams;
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
    }
  | {
      kind: 'spektrogram';
      label: string;
      params: SpektrogramParams;
    }
  | {
      kind: 'band_power';
      label: string;
      params: BandPowerParams;
    };
