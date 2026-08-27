declare module "@yaireo/tagify" {
  type TagifyValue = { value: string; name?: string };
  type TagifySettings = {
    whitelist?: TagifyValue[];
    enforceWhitelist?: boolean;
    skipInvalid?: boolean;
    editTags?: boolean;
    dropdown?: Record<string, unknown>;
  };

  export default class Tagify {
    value: TagifyValue[];
    constructor(input: HTMLInputElement, settings?: TagifySettings);
    on(event: string, callback: (event: unknown) => void): void;
    removeAllTags(): void;
    addTags(tags: TagifyValue[]): void;
  }
}
