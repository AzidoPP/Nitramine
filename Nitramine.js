(() => {
  // ============================================================
  // nitramine — Copy Current Question (SPA-friendly)
  // Author: https://github.com/azidopp
  //
  // Paste into DevTools console.
  // Floating UI with one-click copy.
  // Every time you click "Copy", it re-detects and re-parses the CURRENT question.
  //
  // Output format:
  //   Question <N>
  //   <Passage/Feature (optional)>
  //   <Question stimulus>
  //
  //   A. ...
  //   B. ...
  // ============================================================

  const TOOL_ID = "nitramine-qcopy";

  // ---------- utils ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const normalize = (s) =>
    (s ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

  // ---------- math/table/image extraction ----------
  const pickMathText = (node) => {
    if (!node) return "";

    // Prefer MathJax aria-label
    const aria = node.closest?.("span.math_expression")?.querySelector?.("[aria-label]");
    if (aria?.getAttribute("aria-label")) return aria.getAttribute("aria-label");

    // Assistive MML alttext
    const altMath =
      node.querySelector?.("mjx-assistive-mml math[alttext]") ||
      node.closest?.("mjx-container")?.querySelector?.("mjx-assistive-mml math[alttext]");
    if (altMath?.getAttribute("alttext")) return altMath.getAttribute("alttext");

    // Any aria-label fallback
    const anyAria = node.querySelector?.("[aria-label]") || node.closest?.("[aria-label]");
    if (anyAria?.getAttribute("aria-label")) return anyAria.getAttribute("aria-label");

    return "";
  };

  // Convert a DOM node to clean readable text; replace math/img; remove sr-only duplicates
  const nodeToText = (root) => {
    if (!root) return "";
    const clone = root.cloneNode(true);

    // Key fix: remove accessibility-only duplicates (prevents double options)
    $$(".sr-only", clone).forEach((el) => el.remove());

    // Images -> alt / aria-label / title
    $$("img", clone).forEach((img) => {
      const t =
        img.getAttribute("alt") ||
        img.getAttribute("aria-label") ||
        img.getAttribute("title") ||
        "[image]";
      const span = document.createElement("span");
      span.textContent = t;
      img.replaceWith(span);
    });

    // Math-like nodes -> aria/alttext
    const mathLike = $$(
      "span.math_expression, mjx-container, mjx-math, mjx-assistive-mml, .MathJax, [role='math']",
      clone
    );
    mathLike.forEach((el) => {
      const t = pickMathText(el) || el.textContent;
      const span = document.createElement("span");
      span.textContent = t;
      el.replaceWith(span);
    });

    // br -> newline
    $$("br", clone).forEach((br) => br.replaceWith("\n"));

    // readability line breaks
    $$("p", clone).forEach((p) => p.appendChild(document.createTextNode("\n")));
    $$("li", clone).forEach((li) => li.appendChild(document.createTextNode("\n")));
    $$("pre", clone).forEach((pre) => pre.appendChild(document.createTextNode("\n")));

    return normalize(clone.innerText);
  };

  // ---------- visibility / scoring ----------
  const isVisible = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)
      return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const area = (el) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, r.width) * Math.max(0, r.height);
  };

  const inViewportScore = (el) => {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth,
      vh = window.innerHeight;
    const iw = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const ih = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return iw * ih;
  };

  // ---------- find "current question root" ----------
  // Prefer the element that actually contains the question toolbar number.
  const findQuestionRoots = () => {
    // Most reliable: widgets that have the toolbar question number
    const byNumber = $$("[data-cy='question-number']")
      .filter(isVisible)
      .map((n) => n.closest(".lrn_widget, .lrn_question, .right-column, .response-content, .lrn_qr") || n.parentElement)
      .filter(Boolean);

    if (byNumber.length) return byNumber;

    // Original heuristic
    const q = $$(".lrn_question").filter(isVisible);
    if (q.length) return q;

    // Fallback
    return [document.body];
  };

  const pickCurrentQuestionRoot = () => {
    const cands = findQuestionRoots();

    // Prefer root with visible question-number, then most in view
    const scored = cands
      .map((r) => {
        const n = $("[data-cy='question-number']", r);
        const hasNum = n && isVisible(n);
        return { r, hasNum, score: inViewportScore(r) * 2 + area(r) };
      })
      .sort((a, b) => {
        if (a.hasNum !== b.hasNum) return b.hasNum - a.hasNum;
        return b.score - a.score;
      });

    return scored[0]?.r || document.body;
  };

  // Get question number text (e.g., "1")
  const getQuestionNumber = (questionRoot) => {
    const n =
      $("[data-cy='question-number']", questionRoot) ||
      $("[data-cy='question-number']") ||
      null;
    return normalize(n?.textContent || "");
  };

  // ---------- two-column passage/feature (left column) ----------
  const getLeftPassageFromLayout = (questionRoot) => {
    // Find the closest two-columns wrapper and its left column
    const wrapper =
      questionRoot.closest(".two-columns-wrapper") ||
      $(".two-columns-wrapper") ||
      null;
    if (!wrapper) return "";

    const left =
      $(".left-column", wrapper) ||
      $(".two-columns.left-column", wrapper) ||
      null;
    if (!left || !isVisible(left)) return "";

    // Prefer Learnosity feature shared passage content
    const feature =
      $(".lrn_sharedpassage", left) ||
      $(".lrn_feature", left) ||
      $(".lrn_stimulus_content", left) ||
      left;

    return nodeToText(feature);
  };

  // ---------- question stimulus + options ----------
  const getStimulus = (questionRoot) => {
    const stim =
      $(".lrn_stimulus_content", questionRoot) ||
      $(".lrn_stimulus .lrn_stimulus_content", questionRoot) ||
      null;
    return nodeToText(stim);
  };

  const getOptions = (questionRoot) => {
    // Prefer options within the question root
    let options = $$(".lrn-mcq-option", questionRoot).filter(isVisible);
    if (!options.length) {
      // Fallback global
      options = $$(".lrn-mcq-option").filter(isVisible);
    }
    if (!options.length) return [];

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    return options.map((li, idx) => {
      // Detect letter from sr-only "Option A,"
      let letter = "";
      const sr = $(".sr-only", li);
      if (sr) {
        const m = sr.textContent.match(/Option\s+([A-Z])/i);
        if (m) letter = m[1].toUpperCase();
      }
      if (!letter) letter = letters[idx] || String(idx + 1);

      const possible = $(".lrn-possible-answer", li) || li;

      // Extract text WITHOUT sr-only duplicates (handled in nodeToText)
      const text = nodeToText(possible).replace(/^Option\s+[A-Z],\s*/i, "").trim();
      return { letter, text };
    });
  };

  // ---------- output ----------
  const buildOutput = () => {
    const questionRoot = pickCurrentQuestionRoot();

    const qNum = getQuestionNumber(questionRoot);
    const passage = getLeftPassageFromLayout(questionRoot); // optional
    const stem = getStimulus(questionRoot);
    const opts = getOptions(questionRoot);

    const out = [];

    // Header
    out.push(`Question ${qNum || "?"}`);

    // Passage/feature on the left (if any)
    if (passage) {
      out.push("");
      out.push(passage);
    }

    // Question prompt/stimulus (right)
    out.push("");
    out.push(stem || "[No question stimulus found]");

    // Options
    out.push("");
    if (opts.length) {
      out.push(...opts.map((o) => `${o.letter}. ${o.text}`));
    } else {
      out.push("[No options found]");
    }

    return normalize(out.join("\n"));
  };

  // ---------- copy ----------
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (_) {}
      ta.remove();
      return ok;
    }
  };

  // ---------- UI ----------
  const removeOld = () => {
    const old = document.getElementById(TOOL_ID);
    if (old) old.remove();
  };

  const createPanel = () => {
    removeOld();

    const panel = document.createElement("div");
    panel.id = TOOL_ID;
    panel.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 16px;
      width: 360px;
      z-index: 2147483647;
      background: rgba(20,20,20,0.95);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
      overflow: hidden;
    `;

    panel.innerHTML = `
      <div data-role="header" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.12);">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;gap:8px;align-items:baseline;">
            <div style="font-size:13px;font-weight:800;letter-spacing:0.2px;">nitramine</div>
            <a href="https://github.com/azidopp" target="_blank" rel="noopener noreferrer"
               style="font-size:11px;opacity:0.8;color:#fff;text-decoration:underline;">
              by azidopp
            </a>
          </div>
          <div style="font-size:11px;opacity:0.7;">Copy current question (includes passage + question number)</div>
        </div>
        <button data-act="close" title="Close" style="border:none;background:transparent;color:#fff;cursor:pointer;font-size:16px;line-height:16px;">✕</button>
      </div>

      <div style="padding:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button data-act="copy" style="flex:1;min-width:160px;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:900;background:#3b82f6;color:#fff;">
          Copy
        </button>
        <button data-act="preview" style="flex:1;min-width:160px;border:1px solid rgba(255,255,255,0.18);border-radius:10px;padding:10px;cursor:pointer;font-weight:900;background:transparent;color:#fff;">
          Preview
        </button>
      </div>

      <div style="padding:0 12px 12px 12px;">
        <div data-role="status" style="font-size:12px;opacity:0.85;line-height:1.35;">
          Ready (each click re-parses the current question)
        </div>

        <textarea data-role="box" spellcheck="false" style="
          margin-top:10px;
          width:100%;
          height:180px;
          resize:vertical;
          border-radius:10px;
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.25);
          color:#fff;
          padding:10px;
          font-size:12px;
          line-height:1.35;
          outline:none;
          display:none;
        "></textarea>
      </div>
    `;

    document.body.appendChild(panel);

    // drag
    const header = panel.querySelector("[data-role='header']");
    header.style.cursor = "move";
    let dragging = false,
      sx = 0,
      sy = 0,
      sr = 0,
      sb = 0;

    header.addEventListener("mousedown", (e) => {
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      const rect = panel.getBoundingClientRect();
      sr = window.innerWidth - rect.right;
      sb = window.innerHeight - rect.bottom;
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      panel.style.right = Math.max(0, sr - dx) + "px";
      panel.style.bottom = Math.max(0, sb - dy) + "px";
    });

    window.addEventListener("mouseup", () => (dragging = false));

    const statusEl = panel.querySelector("[data-role='status']");
    const boxEl = panel.querySelector("[data-role='box']");
    const setStatus = (m) => (statusEl.textContent = m);

    const doPreview = () => {
      const text = buildOutput();
      boxEl.style.display = "block";
      boxEl.value = text;
      setStatus("Preview generated (click again to refresh).");
    };

    const doCopy = async () => {
      const text = buildOutput();
      const ok = await copyText(text);
      if (ok) setStatus("✅ Copied to clipboard");
      else {
        setStatus("⚠️ Copy failed: output shown in the preview box for manual copy.");
        boxEl.style.display = "block";
        boxEl.value = text;
      }
    };

    panel.addEventListener("click", (e) => {
      const act = e.target?.getAttribute?.("data-act");
      if (!act) return;
      if (act === "close") return panel.remove();
      if (act === "preview") return doPreview();
      if (act === "copy") return doCopy();
    });

    return panel;
  };

  // ---------- init ----------
  createPanel();
})();
