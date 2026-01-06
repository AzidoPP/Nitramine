# Nitramine

A lightweight DevTools snippet that injects a small floating panel to copy the **current** AP Classroom question text—SPA-friendly and built for fast “copy & paste” workflows.

It can also capture **two-column layouts** (left passage/feature + right question), and it avoids duplicated option text caused by accessibility-only DOM nodes.

<img width="472" height="461" alt="Nitramine UI" src="https://github.com/user-attachments/assets/69317ef4-0267-48bb-af96-14b2b96afc13" />

---

## Features

- **One-click Copy** of the current question (re-detects on every click)
- **SPA-friendly**: works even when navigating between questions without page reloads
- **Includes question number** in the copied output (`Question 1`, `Question 2`, ...)
- **Supports two-column layout**:
  - Copies **left passage/feature** (if present)
  - Copies **right question + answer choices**
- **Math + images support**
  - Prefers accessible labels (`aria-label`, `alttext`, `alt`) for MathJax and images

---

## Usage

1. Open the quiz/test page in your browser.
2. Open **DevTools**:
   - Chrome/Edge: `F12` or `Ctrl+Shift+I` / `Cmd+Option+I`
3. Go to the **Console** tab.
4. Paste the **[script](https://github.com/AzidoPP/Nitramine/blob/main/Nitramine.js)** and press **Enter**.
5. A floating panel will appear at the bottom-right.
6. Click **Copy** to copy the current question, or **Preview** to view the extracted text.

<img width="737" height="870" alt="Paste in DevTools Console" src="https://github.com/user-attachments/assets/32b2428c-1f89-419d-a0b7-4ecd26705557" />

---

## Disclaimer

This script is provided for personal productivity and accessibility convenience.  
Please follow your school’s and College Board’s policies regarding exam content and sharing.

---

## Author

- GitHub: https://github.com/azidopp
