/// <reference types="vite/client" />

declare module '*?inline' {
  const content: string;
  export default content;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'knowledge-tug-of-war': {
        theme?: string;
        'default-questions'?: string;
        ref?: any;
      };
    }
  }
}
