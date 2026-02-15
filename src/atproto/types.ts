// Standard.site lexicon TypeScript types
// Matches AT Protocol Standard.site schemas exactly

// --- XRPC response types ---

export type PutRecordResponse = {
  readonly uri: string;
  readonly cid: string;
};

export type GetRecordResponse<T> = {
  readonly uri: string;
  readonly cid: string;
  readonly value: T;
};

export type ListRecordsResponse<T> = {
  readonly records: readonly {
    readonly uri: string;
    readonly cid: string;
    readonly value: T;
  }[];
  readonly cursor?: string;
};

// --- Document content (open union) ---

export type MarkdownContent = {
  readonly $type: "site.standard.content.markdown";
  readonly value: string;
};

export type HtmlContent = {
  readonly $type: "site.standard.content.html";
  readonly value: string;
};

export type UnknownContent = {
  readonly $type: string;
  readonly value?: string;
};

export type DocumentContent = MarkdownContent | HtmlContent | UnknownContent;

// --- Standard.site lexicon records ---

export type RgbColor = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

export type BasicTheme = {
  readonly $type: "site.standard.theme.basic";
  readonly background: RgbColor;
  readonly foreground: RgbColor;
  readonly accent: RgbColor;
  readonly accentForeground: RgbColor;
};

export type Publication = {
  readonly $type: "site.standard.publication";
  readonly url: string;
  readonly name: string;
  readonly description?: string;
  readonly basicTheme?: BasicTheme;
  readonly preferences?: Record<string, unknown>;
};

export type StandardDocument = {
  readonly $type: "site.standard.document";
  readonly site: string; // AT-URI of the publication
  readonly title: string;
  readonly publishedAt: string; // ISO 8601
  readonly path: string;
  readonly description?: string;
  readonly content?: DocumentContent;
  readonly textContent?: string;
  readonly tags?: readonly string[];
  readonly updatedAt?: string; // ISO 8601
};

export type Subscription = {
  readonly $type: "site.standard.graph.subscription";
  readonly publication: string; // AT-URI of publication
};
