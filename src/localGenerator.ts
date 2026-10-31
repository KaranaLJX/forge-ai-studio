import type { ProjectFiles } from "./types";
import { starterFiles } from "./starter";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export function localGenerate(prompt: string, current: ProjectFiles) {
  const files = clone(Object.keys(current).length ? current : starterFiles);
  const lower = prompt.toLowerCase();
  let summary = "Refined the interface and kept the working data flow intact.";
  const css = files["/styles.css"]?.code ?? "";

  if (/绿色|green|森林/.test(lower)) {
    files["/styles.css"] = { code: css.replaceAll("#64755b", "#16865b").replaceAll("#53644b", "#107048").replaceAll("#5d6e54", "#16865b") };
    summary = "Switched the product to a fresh emerald theme.";
  } else if (/紫色|purple|violet/.test(lower)) {
    files["/styles.css"] = { code: css.replaceAll("#64755b", "#7057d9").replaceAll("#53644b", "#5c43bd").replaceAll("#5d6e54", "#7057d9") };
    summary = "Applied a clear violet visual system across the app.";
  } else if (/深色|dark/.test(lower)) {
    files["/styles.css"] = { code: css + "\nbody{background:#121311;color:#f2f3ef}.panel,.stats article{background:#1d1f1c;border-color:#30332e}.row,.panelHead{border-color:#333630}.form input{background:#161815;color:white;border-color:#3c4039}p,.stats span,.stats small,.row small{color:#9da198}" };
    summary = "Added a focused dark mode while preserving contrast and hierarchy.";
  } else if (/任务|待办|todo|task/.test(lower)) {
    files["/App.js"] = { code: files["/App.js"].code.replaceAll("Trip budget", "Focus board").replaceAll("旅行", "任务").replaceAll("expense", "task").replaceAll("Expense", "Task").replaceAll("$ {item.amount}", "{item.paid ? 'Done' : 'In progress'}").replaceAll("$ {total.toLocaleString()}", "{items.length}").replaceAll("New expense", "New task").replaceAll("Add to plan", "Add task") };
    summary = "Created an interactive task workspace with completion controls.";
  } else {
    summary = "Built a polished, interactive starter app. Try asking for a green, violet, or dark theme, or turn it into a task board.";
  }

  return { files, summary, mode: "demo" as const };
}
