# Handoff Report — Milestone 3 (Local Storage & Web Crypto API)
**Role**: Explorer 3 (Read-only Investigation)
**Target File**: `d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war\src\app.tsx`

---

## 1. Observation

Direct observations from the project codebase and requirements:

- **Source Code (`src/app.tsx`)**:
  - The current import handling (`lines 195-218`) only verifies if the parsed data is an array:
    ```typescript
    const data = JSON.parse(e.target?.result as string);
    if (Array.isArray(data)) {
      send({ type: 'IMPORT_QUESTIONS', questions: data });
    } else {
      alert('Định dạng đề thi không hợp lệ. Phải là một mảng JSON.');
    }
    ```
  - The import uses `alert()` for errors. There is no file size validation, no FileReader error handling (via `onerror` or `onabort`), and no schema checking for the questions' objects.
  - The export handler (`lines 220-228`) triggers a download but has no guard for an empty questions array:
    ```typescript
    const handleExportJSON = () => {
      const blob = new Blob([JSON.stringify(state.context.questions, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      ...
    ```
  - The Import, Export, and Reset buttons are directly visible in the main footer (`lines 454-475`), which clutter the player interface. There is no dedicated toggleable Admin Panel.
  - There is no logic for `localStorage` persistence, meaning questions revert back to `defaultQuestions` on page refresh.
  - The root element layout (`lines 234-235`) is fluid with a minimum height:
    ```typescript
    <div className="w-full min-h-[500px] flex flex-col justify-between bg-surface text-on-surface font-body select-none p-6 rounded-2xl border-2 border-surface-dim box-border">
    ```
    This lacks 16:9 ratio enforcement and dynamic scaling.

- **Design System (`DESIGN.md` & `brandkit.md`)**:
  - Requires responsive 16:9 scale (Milestone 4 alignment).
  - Component shapes should be `rounded-lg` (1rem) for standard UI components, buttons, and inputs to feel tactile.
  - Layout has three distinct sections: Arena (Center), Dashboard (Bottom), and HUD (Top).

---

## 2. Logic Chain

From the observations, the following design decisions are inferred step-by-step:

1. **Admin Panel UI Integration**:
   - *Rationale*: To keep the student UI clean and prevent tampering, the administrative actions (JSON Import, Export, Reset, Question List, Hash Utilities) must be moved into a toggleable modal panel.
   - *Design*: Add a gear icon `⚙️` in a corner of the screen. Toggling this button changes a state variable `isAdminOpen: boolean`.
   - *Secure Access*: If `admin-password` attribute is defined on the host element, require a password prompt before unlocking the panel.
   - *Visual style*: A modular dialog with `backdrop-filter: blur(4px)` and a tabbed interface separating Question Management, Import/Export, and manual Hash Generator tools.

2. **Secure and Cryptographically Verified JSON Import/Export**:
   - *Size Guard*: Add a check `file.size > 500 * 1024` (500KB limit) to avoid browser crashes and memory DOS attacks.
   - *FileReader Robustness*: Attach `onerror` and `onabort` event listeners, clearing the file input value so users can retry the same file if modified.
   - *Schema Validation*: Validate every field in each question: `id` (non-empty string), `question` (non-empty string), `options` (array of exactly 4 non-empty strings), `answer_hash` (64-char hex string), and `salt` (optional string).
   - *Cryptographic Validation*: Prevent unplayable questions by verifying that **exactly one option** hashes to the `answer_hash` using the provided salt. We run `verifyAnswer` for all 4 options during validation. If no option matches, or if more than one option matches, the import is rejected with detailed error logs.
   - *Local Storage Persistence*: On successful validation, update context and write to `localStorage` (key: `tug_of_war_questions`). On initial app mount, check `localStorage` first before falling back to `defaultQuestions`.

3. **16:9 Letterbox Scaling Coordination**:
   - *Scaling Hook*: Implement a `ResizeObserver` listener on the parent container. The game canvas will be fixed at `960px` width and `540px` height (or `1280x720`).
   - *Calculation*: The scale factor is determined by `Math.min(parentWidth / virtualWidth, parentHeight / virtualHeight)`.
   - *CSS Transform*: Apply `transform: scale(scale)` and `transform-origin: center center` to center the canvas.
   - *Admin Panel Layer Positioning*: Mount the Admin Panel **outside** the scaled container. If the game scales down on a mobile screen (e.g. `scale: 0.3`), editing questions or reading validation errors in a scaled-down modal would be impossible. Rendering it as a full-size overlay at `scale: 1` ensures native accessibility and clear typography.

---

## 3. Caveats

- **ResizeObserver Compatibility**: Older browsers might not support `ResizeObserver` natively, though it is standard in all modern environments. A simple fallback using `window.addEventListener('resize')` is recommended.
- **Async Validation Lag**: Calculating SHA-256 hashes asynchronously for a large set of imported questions (e.g., 50+ questions) might take a few milliseconds. We must show a "Validating..." loading spinner in the Admin UI during the import operation.
- **Salt Generation**: Manual question creation in the admin panel should auto-generate a random 8-character salt to ensure cryptographic strength.

---

## 4. Conclusion

We conclude that:
- Adding `localStorage` persistence completes the data loop of Milestone 3.
- Implementing cryptographic validation on import is the single most effective way to guarantee game playability and robust user input sanitization.
- Positioning the Admin Panel overlay outside the 16:9 scaled canvas solves layout and readability issues on small screens.

---

## 5. Proposed Changes & Implementation Strategy for `app.tsx`

Below is the concrete proposal for modifying `src/app.tsx`.

### 5.1 Local Storage Initialization and Sync
Modify the initialization of the FSM actor to load from `localStorage` first, and set up a listener to save questions whenever they change:

```tsx
// 1. Initial questions read from Local Storage
const getInitialQuestions = (defaultQuestions: Question[]): Question[] => {
  try {
    const saved = localStorage.getItem('tug_of_war_questions');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load questions from localStorage:', err);
  }
  return defaultQuestions || [];
};

// Inside App component:
const actor = useMemo(() => {
  return createActor(tugOfWarMachine, {
    input: { questions: getInitialQuestions(defaultQuestions) }
  }).start();
}, []);

// Effect to persist questions when state changes
useEffect(() => {
  const currentQuestions = state.context.questions;
  if (currentQuestions && currentQuestions.length > 0) {
    localStorage.setItem('tug_of_war_questions', JSON.stringify(currentQuestions));
  }
}, [state.context.questions]);
```

---

### 5.2 JSON Validation and Cryptographic Check Helper
Create a helper function to validate the imported JSON structure and cryptographic answer hashes:

```typescript
import { verifyAnswer, hashAnswer } from './crypto';

interface ValidationError {
  index: number;
  questionId?: string;
  message: string;
}

export async function validateQuestionsJSON(
  fileContent: string
): Promise<{ isValid: boolean; errors: ValidationError[]; questions?: Question[] }> {
  const errors: ValidationError[] = [];
  let parsed: any;

  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    return { isValid: false, errors: [{ index: -1, message: 'Định dạng file không đúng chuẩn JSON.' }] };
  }

  if (!Array.isArray(parsed)) {
    return { isValid: false, errors: [{ index: -1, message: 'Nội dung file phải là một mảng câu hỏi JSON.' }] };
  }

  if (parsed.length === 0) {
    return { isValid: false, errors: [{ index: -1, message: 'Mảng câu hỏi không được rỗng.' }] };
  }

  const validatedQuestions: Question[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const q = parsed[i];
    const qId = q?.id || `q_index_${i}`;
    const prefix = `Câu hỏi #${i + 1} [ID: ${qId}]:`;

    if (!q || typeof q !== 'object') {
      errors.push({ index: i, questionId: qId, message: `${prefix} Cấu trúc đối tượng không hợp lệ.` });
      continue;
    }

    if (typeof q.id !== 'string' || !q.id.trim()) {
      errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'id' phải là chuỗi không rỗng.` });
    }

    if (typeof q.question !== 'string' || !q.question.trim()) {
      errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'question' phải là chuỗi không rỗng.` });
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'options' phải chứa đúng 4 đáp án.` });
    } else {
      const hasInvalidOption = q.options.some((opt: any) => typeof opt !== 'string' || !opt.trim());
      if (hasInvalidOption) {
        errors.push({ index: i, questionId: qId, message: `${prefix} Tất cả các đáp án trong 'options' phải là chuỗi không rỗng.` });
      }
    }

    const sha256HexRegex = /^[a-fA-F0-9]{64}$/;
    if (typeof q.answer_hash !== 'string' || !sha256HexRegex.test(q.answer_hash)) {
      errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'answer_hash' phải là chuỗi mã hóa SHA-256 hợp lệ (64 ký tự hex).` });
    }

    if (q.salt !== undefined && typeof q.salt !== 'string') {
      errors.push({ index: i, questionId: qId, message: `${prefix} Trường 'salt' nếu được cung cấp phải là chuỗi ký tự.` });
    }

    // Cryptographic validation (Ensure exactly one option matches the answer hash)
    if (!errors.some(e => e.index === i)) {
      const salt = q.salt || '';
      const options = q.options as string[];
      let correctMatches = 0;

      for (const option of options) {
        const isMatch = await verifyAnswer(option, salt, q.answer_hash);
        if (isMatch) correctMatches++;
      }

      if (correctMatches === 0) {
        errors.push({
          index: i,
          questionId: qId,
          message: `${prefix} Lỗi kiểm tra băm: Không có đáp án nào khớp với 'answer_hash'. Kiểm tra lại đáp án đúng và salt.`
        });
      } else if (correctMatches > 1) {
        errors.push({
          index: i,
          questionId: qId,
          message: `${prefix} Lỗi kiểm tra băm: Có nhiều hơn 1 đáp án khớp với 'answer_hash'.`
        });
      }
    }

    if (!errors.some(e => e.index === i)) {
      validatedQuestions.push({
        id: String(q.id).trim(),
        question: String(q.question).trim(),
        options: (q.options as string[]).map(o => o.trim()),
        answer_hash: String(q.answer_hash).trim(),
        salt: q.salt ? String(q.salt).trim() : undefined
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    questions: errors.length === 0 ? validatedQuestions : undefined
  };
}
```

---

### 5.3 16:9 Letterboxing Scale Hook
Create the responsive hook that calculates the fit scale ratio:

```typescript
import { useState, useEffect, useRef } from 'preact/hooks';

export function useAspectRatioScaler(targetWidth = 960, targetHeight = 540) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const calculateScale = () => {
      const parent = el.parentElement;
      if (!parent) return;

      const parentWidth = parent.clientWidth;
      const parentHeight = parent.clientHeight || window.innerHeight; // fallback if parent has height auto

      const scaleX = parentWidth / targetWidth;
      const scaleY = parentHeight / targetHeight;
      
      // Let's letterbox scale (fit the smaller dimension)
      const newScale = Math.min(scaleX, scaleY);
      setScale(newScale || 1);
    };

    calculateScale();

    const resizeObserver = new ResizeObserver(calculateScale);
    if (el.parentElement) {
      resizeObserver.observe(el.parentElement);
    }

    window.addEventListener('resize', calculateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateScale);
    };
  }, [targetWidth, targetHeight]);

  return { containerRef, scale };
}
```

---

### 5.4 Admin Panel UI Overlay structure
We implement the Admin Panel UI as a Preact functional component (or sub-render function inside `app.tsx`). The layout of the main view and the Admin Panel coordinates scaling:

```tsx
// In App component:
const [isAdminOpen, setIsAdminOpen] = useState(false);
const [activeTab, setActiveTab] = useState<'questions' | 'import' | 'hash'>('questions');
const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
const [isValidating, setIsValidating] = useState(false);

// New question form state
const [newQText, setNewQText] = useState('');
const [newQOptions, setNewQOptions] = useState(['', '', '', '']);
const [newQCorrectIdx, setNewQCorrectIdx] = useState(0);
const [newQSalt, setNewQSalt] = useState('');

// For Hash Utility Tool
const [hashInput, setHashInput] = useState('');
const [hashSaltInput, setHashSaltInput] = useState('');
const [generatedHash, setGeneratedHash] = useState('');

const handleGenerateHash = async () => {
  const hash = await hashAnswer(hashInput, hashSaltInput);
  setGeneratedHash(hash);
};

const handleAddQuestion = async (e: Event) => {
  e.preventDefault();
  if (!newQText.trim() || newQOptions.some(o => !o.trim())) {
    alert('Vui lòng điền đầy đủ câu hỏi và 4 đáp án.');
    return;
  }
  
  const salt = newQSalt.trim() || Math.random().toString(36).substring(2, 10);
  const correctText = newQOptions[newQCorrectIdx];
  const answer_hash = await hashAnswer(correctText, salt);

  const newQuestion: Question = {
    id: `q_${Date.now()}`,
    question: newQText.trim(),
    options: newQOptions.map(o => o.trim()),
    answer_hash,
    salt
  };

  const updatedQuestions = [...state.context.questions, newQuestion];
  send({ type: 'IMPORT_QUESTIONS', questions: updatedQuestions });
  
  // Reset form
  setNewQText('');
  setNewQOptions(['', '', '', '']);
  setNewQCorrectIdx(0);
  setNewQSalt('');
};

// Secure JSON Import Handler
const handleSecureImportJSON = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Guard: Max Size 500KB
    if (file.size > 500 * 1024) {
      setValidationErrors([{ index: -1, message: 'Kích thước file vượt quá giới hạn cho phép (500KB).' }]);
      return;
    }

    setIsValidating(true);
    setValidationErrors([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const result = await validateQuestionsJSON(text);
        
        if (result.isValid && result.questions) {
          send({ type: 'IMPORT_QUESTIONS', questions: result.questions });
          setValidationErrors([]);
          alert('Tải đề thi JSON thành công!');
        } else {
          setValidationErrors(result.errors || []);
        }
      } catch (err) {
        setValidationErrors([{ index: -1, message: 'Đã xảy ra lỗi không xác định khi xử lý file.' }]);
      } finally {
        setIsValidating(false);
      }
    };

    reader.onerror = () => {
      setValidationErrors([{ index: -1, message: 'Lỗi FileReader khi đọc file.' }]);
      setIsValidating(false);
    };

    reader.onabort = () => {
      setValidationErrors([{ index: -1, message: ' FileReader đã bị hủy bỏ.' }]);
      setIsValidating(false);
    };

    reader.readAsText(file);
  };
  input.click();
};
```

---

### 5.5 Layout & Scaler Coordination Integration

Update the JSX returned by the `App` component. The Admin Panel is positioned at the root level, *outside* the scaled game canvas. This prevents the Admin panel from becoming too small and hard to read on mobile.

```tsx
const { containerRef, scale } = useAspectRatioScaler(960, 540);

return (
  <div className="w-full h-full min-h-[540px] flex items-center justify-center bg-[#0d1527] overflow-hidden relative">
    
    {/* 1. Main 16:9 Game Container (Scaled via CSS transform) */}
    <div 
      ref={containerRef}
      style={{
        width: '960px',
        height: '540px',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        flexShrink: 0
      }}
      className="relative flex flex-col justify-between bg-surface text-on-surface font-body select-none p-6 rounded-2xl border-2 border-surface-dim box-border shadow-2xl transition-all duration-300"
    >
      {/* Game HUD */}
      {/* Game Main Arena */}
      {/* Game Tug of War Progress Bar */}
      
      {/* Simple Admin Entry Gear Button inside scaled footer */}
      <footer className="flex justify-between items-center text-xs border-t-2 border-surface-dim pt-4">
        <span className="font-display font-extrabold tracking-wider text-on-surface">
          THEME: {theme.toUpperCase()}
        </span>
        <div className="flex gap-2 items-center">
          <button 
            onClick={() => setIsAdminOpen(true)}
            className="p-2 bg-neutral-200 text-neutral-800 rounded-lg font-bold hover:bg-neutral-300 transition-colors"
            title="Mở Bảng Điều Khiển Admin"
          >
            ⚙️ Admin
          </button>
        </div>
      </footer>
    </div>

    {/* 2. Admin Panel Overlay - MOUNTED OUTSIDE THE 16:9 CANVAS (Native Scale) */}
    {isAdminOpen && (
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 transition-all duration-300">
        <div className="bg-white rounded-2xl border-2 border-surface-dim w-full max-w-3xl max-h-[90%] flex flex-col overflow-hidden shadow-2xl">
          
          {/* Header */}
          <div className="flex justify-between items-center bg-surface-container-high p-4 border-b-2 border-surface-dim">
            <h3 className="font-display font-bold text-lg text-on-surface flex items-center gap-2">
              ⚙️ Bảng Điều Khiển Admin
            </h3>
            <button 
              onClick={() => setIsAdminOpen(false)}
              className="text-neutral-500 hover:text-neutral-800 font-bold text-xl px-2"
            >
              &times;
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-surface-dim bg-surface-container">
            <button 
              onClick={() => setActiveTab('questions')}
              className={`flex-1 py-2.5 font-display text-sm font-bold border-b-2 transition-all ${activeTab === 'questions' ? 'border-primary text-primary' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
            >
              Danh sách câu hỏi ({state.context.questions.length})
            </button>
            <button 
              onClick={() => setActiveTab('import')}
              className={`flex-1 py-2.5 font-display text-sm font-bold border-b-2 transition-all ${activeTab === 'import' ? 'border-primary text-primary' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
            >
              Import / Export JSON
            </button>
            <button 
              onClick={() => setActiveTab('hash')}
              className={`flex-1 py-2.5 font-display text-sm font-bold border-b-2 transition-all ${activeTab === 'hash' ? 'border-primary text-primary' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
            >
              Tiện ích Tạo Hash
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 font-body text-sm">
            
            {/* Tab 1: Questions list & Add Form */}
            {activeTab === 'questions' && (
              <div className="space-y-6">
                {/* Form to Add Question */}
                <form onSubmit={handleAddQuestion} className="bg-surface-container-low p-4 rounded-xl border border-surface-dim space-y-4">
                  <h4 className="font-display font-bold text-on-surface">Thêm câu hỏi mới</h4>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-neutral-600">Câu hỏi</label>
                    <input 
                      type="text" 
                      value={newQText} 
                      onChange={e => setNewQText((e.target as HTMLInputElement).value)}
                      placeholder="Nhập câu hỏi..." 
                      className="w-full p-2 border border-surface-dim rounded bg-white text-on-surface"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {newQOptions.map((opt, idx) => (
                      <div key={idx} className="space-y-1">
                        <label className="block text-xs font-bold text-neutral-600">Đáp án {String.fromCharCode(65 + idx)}</label>
                        <div className="flex gap-2 items-center">
                          <input 
                            type="radio" 
                            name="correct_option" 
                            checked={newQCorrectIdx === idx}
                            onChange={() => setNewQCorrectIdx(idx)}
                            title="Đánh dấu đây là đáp án ĐÚNG"
                          />
                          <input 
                            type="text" 
                            value={opt} 
                            onChange={e => {
                              const opts = [...newQOptions];
                              opts[idx] = (e.target as HTMLInputElement).value;
                              setNewQOptions(opts);
                            }}
                            placeholder={`Đáp án ${String.fromCharCode(65 + idx)}...`} 
                            className="flex-1 p-2 border border-surface-dim rounded bg-white text-on-surface"
                            required
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-neutral-600">Salt (tùy chọn - tự sinh nếu bỏ trống)</label>
                      <input 
                        type="text" 
                        value={newQSalt} 
                        onChange={e => setNewQSalt((e.target as HTMLInputElement).value)}
                        placeholder="Chuỗi salt ngẫu nhiên..." 
                        className="w-full p-2 border border-surface-dim rounded bg-white text-on-surface"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        type="submit"
                        className="w-full py-2 bg-primary text-white font-bold rounded hover:bg-green-700 transition-colors"
                      >
                        + Lưu câu hỏi
                      </button>
                    </div>
                  </div>
                </form>

                {/* Question List Table */}
                <div className="space-y-3">
                  <h4 className="font-display font-bold text-on-surface">Danh sách câu hỏi hiện tại</h4>
                  {state.context.questions.length === 0 ? (
                    <p className="text-neutral-500 italic">Chưa có câu hỏi nào được nạp.</p>
                  ) : (
                    <div className="border border-surface-dim rounded-xl overflow-hidden">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-surface-container">
                            <th className="p-3 text-xs font-bold text-neutral-600 border-b border-surface-dim">ID</th>
                            <th className="p-3 text-xs font-bold text-neutral-600 border-b border-surface-dim">Câu hỏi</th>
                            <th className="p-3 text-xs font-bold text-neutral-600 border-b border-surface-dim">Salt</th>
                            <th className="p-3 text-xs font-bold text-neutral-600 border-b border-surface-dim">Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.context.questions.map((q, idx) => (
                            <tr key={q.id || idx} className="hover:bg-surface-container-lowest">
                              <td className="p-3 font-mono text-xs border-b border-surface-dim">{q.id}</td>
                              <td className="p-3 border-b border-surface-dim max-w-xs truncate">{q.question}</td>
                              <td className="p-3 font-mono text-xs text-neutral-500 border-b border-surface-dim">{q.salt || '-'}</td>
                              <td className="p-3 border-b border-surface-dim">
                                <button 
                                  onClick={() => {
                                    const updated = state.context.questions.filter((_, qIdx) => qIdx !== idx);
                                    send({ type: 'IMPORT_QUESTIONS', questions: updated });
                                  }}
                                  className="text-red-500 hover:text-red-700 font-bold hover:underline"
                                >
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Import / Export */}
            {activeTab === 'import' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Import Zone */}
                  <div className="bg-surface-container-low p-6 rounded-xl border-2 border-dashed border-surface-dim flex flex-col items-center justify-center text-center">
                    <p className="font-bold text-on-surface mb-2">Tải lên đề thi mới</p>
                    <p className="text-xs text-neutral-500 mb-4">Hỗ trợ file JSON cấu trúc kéo co dưới 500KB</p>
                    
                    <button 
                      onClick={handleSecureImportJSON}
                      disabled={isValidating}
                      className="px-5 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {isValidating ? 'Đang kiểm tra băm...' : 'Chọn file JSON'}
                    </button>
                  </div>

                  {/* Export Zone */}
                  <div className="bg-surface-container-low p-6 rounded-xl border border-surface-dim flex flex-col items-center justify-center text-center">
                    <p className="font-bold text-on-surface mb-2">Xuất đề thi hiện tại</p>
                    <p className="text-xs text-neutral-500 mb-4">Tải về danh sách câu hỏi hiện tại dưới dạng file JSON</p>
                    
                    <button 
                      onClick={handleExportJSON}
                      disabled={state.context.questions.length === 0}
                      className="px-5 py-2.5 bg-secondary text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      Tải file JSON xuống
                    </button>
                  </div>
                </div>

                {/* Validation Errors Log */}
                {validationErrors.length > 0 && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-2">
                    <p className="font-bold text-red-700 text-sm">Phát hiện lỗi định dạng / bảo mật trong file JSON:</p>
                    <ul className="list-disc pl-5 text-xs text-red-600 space-y-1">
                      {validationErrors.map((err, idx) => (
                        <li key={idx}>{err.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Hash Helper */}
            {activeTab === 'hash' && (
              <div className="space-y-4">
                <p className="text-neutral-600 text-xs">Công cụ tạo mã hóa SHA-256 dùng để viết sẵn câu hỏi trong các trình soạn thảo text bên ngoài.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-neutral-600">Đáp án chính xác</label>
                    <input 
                      type="text" 
                      value={hashInput} 
                      onChange={e => setHashInput((e.target as HTMLInputElement).value)}
                      placeholder="Ví dụ: 4" 
                      className="w-full p-2 border border-surface-dim rounded bg-white text-on-surface"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-neutral-600">Salt</label>
                    <input 
                      type="text" 
                      value={hashSaltInput} 
                      onChange={e => setHashSaltInput((e.target as HTMLInputElement).value)}
                      placeholder="Ví dụ: my-salt" 
                      className="w-full p-2 border border-surface-dim rounded bg-white text-on-surface"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handleGenerateHash}
                    className="px-4 py-2 bg-primary text-white rounded font-bold hover:bg-green-700 transition-colors"
                  >
                    Tạo Hash SHA-256
                  </button>
                  <button 
                    onClick={() => {
                      const rand = Math.random().toString(36).substring(2, 10);
                      setHashSaltInput(rand);
                    }}
                    className="px-4 py-2 bg-neutral-200 text-neutral-800 rounded font-bold hover:bg-neutral-300 transition-colors"
                  >
                    Tạo Salt ngẫu nhiên
                  </button>
                </div>

                {generatedHash && (
                  <div className="space-y-1 pt-2">
                    <label className="block text-xs font-bold text-neutral-600">Kết quả hash (Copy vào trường "answer_hash"):</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={generatedHash} 
                        className="flex-1 p-2 bg-neutral-100 font-mono text-xs border border-surface-dim rounded"
                      />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(generatedHash);
                          alert('Đã copy hash!');
                        }}
                        className="px-3 py-1 bg-neutral-800 text-white rounded text-xs hover:bg-black font-bold"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer Reset button inside Admin Panel */}
          <div className="bg-surface-container-high p-4 border-t-2 border-surface-dim flex justify-between">
            <button 
              onClick={() => {
                if (confirm('Bạn có chắc chắn muốn cài lại điểm số về mặc định?')) {
                  send({ type: 'RESET' });
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
            >
              Reset Điểm & Reset Trận Đấu
            </button>
            <button 
              onClick={() => setIsAdminOpen(false)}
              className="px-4 py-2 bg-neutral-800 text-white rounded-lg font-bold hover:bg-neutral-900 transition-colors"
            >
              Đóng
            </button>
          </div>

        </div>
      </div>
    )}

  </div>
);
```

---

## 6. Verification Method

To verify these changes:
1. **Compilation Check**: Run the build script using `npm run build` from the package directory:
   - Command: `cd d:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war; npm run build`
   - Verify there are no typescript compilation errors.
2. **Import Verification**: 
   - Upload a valid JSON file. Check that the UI successfully imports the questions, registers them, and saves them to `localStorage`. Refresh the browser and verify the questions persist.
   - Upload a corrupted JSON file (e.g. missing `answer_hash`, only 3 options, or a typo in the options such that no option matches the hash). Check that the detailed error reports display inside the Admin Panel, and the import is safely rejected.
3. **Responsive Scaling Check**:
   - Change the browser size or place the Custom Element inside containers of different ratios (e.g. `800x600`, `1920x1080`, `360x740`). Verify the game arena scales cleanly while maintaining a 16:9 ratio, and the Admin Panel remains legible and responsive at `scale: 1`.
