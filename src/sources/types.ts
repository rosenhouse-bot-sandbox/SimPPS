/**
 * Every number on screen can open a pop-over. Tags follow issue #1:
 * F public source, N news, I our inference, M tunable model assumption, V to verify.
 */
export type SourceTag = 'F' | 'N' | 'I' | 'M' | 'V';

export interface SourceLink {
  title: string;
  url: string;
}

/** A hidden card is a model assumption drawn per game and revealed after about 3 years. */
export interface HiddenCard {
  /** Possible values with their probabilities. */
  outcomes: { value: number; label: string; weight: number }[];
  revealAfterYears: number;
}

export interface Source {
  key: string;
  label: string;
  tag: SourceTag;
  /** Plain-language explanation of where the number comes from. */
  explain: string;
  links: SourceLink[];
  hidden?: HiddenCard;
}
