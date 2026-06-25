import { render } from 'preact';
import { App, Question, sanitizeQuestions, SAFE_DEFAULT_QUESTIONS } from './app';
import styles from './styles/index.css?inline';

class KnowledgeTugOfWarElement extends HTMLElement {
  private mountPoint: HTMLDivElement | null = null;
  private shadow: ShadowRoot;
  private _defaultQuestions: Question[] = [];
  private hasValidationError = false;
  private validationErrorMessage = "";

  static get observedAttributes() {
    return ['theme', 'default-questions'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  get defaultQuestions(): Question[] {
    return this._defaultQuestions;
  }

  set defaultQuestions(val: any) {
    try {
      this._defaultQuestions = sanitizeQuestions(val);
      this.hasValidationError = false;
      this.validationErrorMessage = "";
    } catch (err) {
      console.error('Failed to sanitize defaultQuestions setter value:', err);
      this.hasValidationError = true;
      this.validationErrorMessage = err instanceof Error ? err.message : String(err);
      this.dispatchEvent(new CustomEvent('questions-invalid', {
        detail: { error: err instanceof Error ? err.message : String(err) },
        bubbles: true,
        composed: true
      }));
      this._defaultQuestions = [];
    }
    this.renderApp();
  }

  connectedCallback() {
    let styleTag = this.shadow.querySelector('style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.textContent = styles;
      this.shadow.appendChild(styleTag);
    }

    if (!this.mountPoint) {
      this.mountPoint = this.shadow.querySelector('div.w-full.h-full.relative.overflow-hidden');
    }
    if (!this.mountPoint) {
      this.mountPoint = document.createElement('div');
      this.mountPoint.className = 'w-full h-full relative overflow-hidden';
      this.shadow.appendChild(this.mountPoint);
    }

    this.renderApp();
  }

  disconnectedCallback() {
    if (this.mountPoint) {
      render(null, this.mountPoint);
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue && this.mountPoint) {
      if (name === 'default-questions') {
        this.hasValidationError = false;
        this.validationErrorMessage = "";
      }
      this.renderApp();
    }
  }

  private renderApp() {
    if (!this.mountPoint) return;

    const theme = this.getAttribute('theme') || 'kinetic-academy';
    
    let defaultQuestionsList: Question[] = [];
    if (this._defaultQuestions && this._defaultQuestions.length > 0) {
      defaultQuestionsList = this._defaultQuestions;
    } else {
      const rawQuestions = this.getAttribute('default-questions');
      if (rawQuestions) {
        try {
          defaultQuestionsList = sanitizeQuestions(JSON.parse(rawQuestions));
        } catch (err) {
          console.error('Failed to parse or validate default-questions attribute:', err);
          this.hasValidationError = true;
          this.validationErrorMessage = err instanceof Error ? err.message : String(err);
          this.dispatchEvent(new CustomEvent('questions-invalid', {
            detail: { error: err instanceof Error ? err.message : String(err) },
            bubbles: true,
            composed: true
          }));
        }
      }
    }

    render(
      <App 
        theme={theme} 
        defaultQuestions={defaultQuestionsList.length > 0 ? defaultQuestionsList : SAFE_DEFAULT_QUESTIONS} 
        host={this} 
        validationError={this.hasValidationError ? this.validationErrorMessage : null}
      />, 
      this.mountPoint
    );
  }
}

if (!customElements.get('knowledge-tug-of-war')) {
  customElements.define('knowledge-tug-of-war', KnowledgeTugOfWarElement);
}
