import type { ProjectFiles } from "./types";

const appCode = `import { useMemo, useState } from "react";
import "./styles.css";

const seed = [
  { id: 1, title: "Research flight options", category: "Transport", amount: 280, paid: true },
  { id: 2, title: "Book a quiet hotel", category: "Stay", amount: 460, paid: false },
  { id: 3, title: "Local food tour", category: "Food", amount: 95, paid: false },
];

export default function App() {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem("forge-demo-items");
    return saved ? JSON.parse(saved) : seed;
  });
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.amount), 0), [items]);
  const save = (next) => { setItems(next); localStorage.setItem("forge-demo-items", JSON.stringify(next)); };
  const add = (event) => {
    event.preventDefault();
    if (!title.trim() || !amount) return;
    save([...items, { id: Date.now(), title, category: "Other", amount: Number(amount), paid: false }]);
    setTitle(""); setAmount("");
  };

  return <main>
    <header><div><span className="eyebrow">TOKYO · 7 DAYS</span><h1>Trip budget</h1><p>Keep every plan and payment in one calm place.</p></div><button className="avatar">RH</button></header>
    <section className="stats">
      <article><span>Total planned</span><strong>$ {total.toLocaleString()}</strong><small>Across {items.length} expenses</small></article>
      <article><span>Paid</span><strong>$ {items.filter(i => i.paid).reduce((s,i) => s+i.amount,0)}</strong><small>{items.filter(i => i.paid).length} completed</small></article>
      <article className="accent"><span>Remaining</span><strong>$ {Math.max(2000-total,0).toLocaleString()}</strong><small>of $2,000 budget</small></article>
    </section>
    <section className="grid">
      <div className="panel"><div className="panelHead"><div><span className="eyebrow">EXPENSES</span><h2>Plan overview</h2></div><span>{items.length} items</span></div>
        <div className="list">{items.map(item => <div className="row" key={item.id}><button className={item.paid ? "check done" : "check"} onClick={() => save(items.map(i => i.id === item.id ? {...i, paid: !i.paid} : i))}>{item.paid ? "✓" : ""}</button><div><b>{item.title}</b><small>{item.category}</small></div><strong>$ {item.amount}</strong><button className="remove" onClick={() => save(items.filter(i => i.id !== item.id))}>×</button></div>)}</div>
      </div>
      <form className="panel form" onSubmit={add}><span className="eyebrow">QUICK ADD</span><h2>New expense</h2><label>Description<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Museum tickets" /></label><label>Amount<input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="0" /></label><button className="primary">Add to plan <span>→</span></button></form>
    </section>
  </main>;
}`;

const styleCode = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700&display=swap');
*{box-sizing:border-box}body{margin:0;background:#f4f3ef;color:#20211f;font-family:'DM Sans',sans-serif}button,input{font:inherit}main{max-width:1180px;margin:auto;padding:46px 30px 70px}header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:34px}h1,h2{font-family:Manrope,sans-serif;margin:0}h1{font-size:46px;letter-spacing:-2.4px;margin:5px 0 8px}h2{font-size:20px;letter-spacing:-.6px}.eyebrow{font-size:11px;font-weight:700;letter-spacing:1.5px;color:#80837e}p{color:#757873;margin:0}.avatar{border:0;background:#252724;color:white;border-radius:50%;width:44px;height:44px;font-weight:700}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px}.stats article,.panel{background:#fff;border:1px solid #e6e4de;border-radius:18px;padding:24px}.stats span,.stats small{display:block;color:#7b7e79}.stats strong{font:700 29px Manrope;display:block;margin:13px 0 5px}.stats small{font-size:12px}.stats .accent{background:#242622;color:#fff;border-color:#242622}.stats .accent span,.stats .accent small{color:#b7bbb3}.grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,.75fr);gap:12px}.panelHead{display:flex;justify-content:space-between;align-items:center;padding-bottom:18px;border-bottom:1px solid #eeece7}.panelHead>span{font-size:12px;color:#8a8d87}.row{display:grid;grid-template-columns:28px 1fr auto 26px;gap:12px;align-items:center;padding:17px 0;border-bottom:1px solid #efede8}.row:last-child{border-bottom:0}.row b,.row small{display:block}.row small{font-size:12px;color:#92958f;margin-top:3px}.check{width:24px;height:24px;border:1px solid #d8d6cf;border-radius:8px;background:white;color:white}.check.done{background:#5d6e54;border-color:#5d6e54}.remove{border:0;background:transparent;color:#aaa;font-size:20px}.form h2{margin:6px 0 24px}.form label{display:block;font-size:12px;font-weight:600;margin:16px 0;color:#555852}.form input{display:block;width:100%;margin-top:7px;border:1px solid #dedcd5;border-radius:11px;padding:12px 13px;outline:none}.form input:focus{border-color:#68785f;box-shadow:0 0 0 3px #edf1ea}.primary{width:100%;display:flex;justify-content:space-between;margin-top:22px;border:0;border-radius:11px;background:#64755b;color:white;padding:13px 16px;font-weight:700}.primary:hover{background:#53644b}@media(max-width:750px){main{padding:28px 18px}.stats,.grid{grid-template-columns:1fr}h1{font-size:38px}}`;

export const starterFiles: ProjectFiles = {
  "/App.js": { code: appCode },
  "/styles.css": { code: styleCode },
  "/package.json": { code: JSON.stringify({ scripts: { start: "react-scripts start" }, dependencies: { "@vitejs/plugin-react": "latest", vite: "latest", react: "latest", "react-dom": "latest", "react-scripts": "latest" }, devDependencies: {} }, null, 2) },
};

export const blankFiles: ProjectFiles = {
  "/App.js": { code: `import "./styles.css";\n\nexport default function App() {\n  return <main className="blank"><span>NEW PROJECT</span><h1>What will you build?</h1><p>Describe your idea in the project chat and Forge will create it here.</p></main>;\n}` },
  "/styles.css": { code: `*{box-sizing:border-box}body{margin:0;background:#f5f6f2;color:#20231f;font-family:Inter,system-ui,sans-serif}.blank{min-height:100vh;display:grid;place-content:center;text-align:center;padding:32px}.blank span{font-size:11px;letter-spacing:2px;color:#788071}.blank h1{font-size:clamp(36px,7vw,72px);letter-spacing:-3px;margin:12px 0}.blank p{color:#777d74;margin:0}` },
  "/package.json": starterFiles["/package.json"],
};
