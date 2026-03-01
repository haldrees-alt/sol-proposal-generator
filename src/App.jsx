import { useState, useRef } from "react";
import pptxgen from "pptxgenjs";

// ── Templates ──────────────────────────────────────────────────────────────
const TEMPLATES = [
  { id:"corporate",  name:"Corporate",   nameAr:"رسمي",      icon:"🏢", primary:"0D1B4B", secondary:"C9A84C", accent:"1A3CFF", bg:"F4F6FB" },
  { id:"creative",   name:"Creative",    nameAr:"إبداعي",    icon:"🎨", primary:"2D1B69", secondary:"FF6B35", accent:"A855F7", bg:"FAF5FF" },
  { id:"minimal",    name:"Minimal",     nameAr:"بسيط",      icon:"⬜", primary:"111111", secondary:"555555", accent:"000000", bg:"FAFAFA" },
  { id:"tech",       name:"Tech",        nameAr:"تقني",      icon:"💻", primary:"0F172A", secondary:"06B6D4", accent:"3B82F6", bg:"F0F9FF" },
  { id:"consulting", name:"Consulting",  nameAr:"استشاري",   icon:"📊", primary:"0D3B2E", secondary:"A8C5B5", accent:"10B981", bg:"F0FDF4" },
  { id:"realestate", name:"Real Estate", nameAr:"عقاري",     icon:"🏗️", primary:"2C1810", secondary:"D4A96A", accent:"92400E", bg:"FFFBF5" },
];

// ── i18n ───────────────────────────────────────────────────────────────────
const T = {
  en: {
    title:"SOL Proposal Generator", step1:"Client Info", step2:"Template", step3:"Content",
    clientName:"Client / Company Name *", industry:"Industry *", budget:"Budget *",
    currency:"Currency", tone:"Tone", lang:"Language", services:"Services Offered *",
    challenges:"Client Challenges", solution:"Proposed Solution", team:"Team Members",
    payment:"Payment Terms", timeline:"Timeline", notes:"Additional Notes",
    logoPos:"Logo Position", left:"Left", center:"Center", right:"Right",
    next:"Next →", back:"← Back", generate:"✨ Generate Proposal",
    generating:"Generating...", download:"⬇️ Download PPTX", edit:"✏️ Edit",
    prev:"← Prev", tip:"PPTX opens in PowerPoint. For Google Slides: File → Import Slides.",
    professional:"Professional", friendly:"Friendly", formal:"Formal",
    english:"English", arabic:"Arabic",
  },
  ar: {
    title:"مولّد عروض SOL", step1:"بيانات العميل", step2:"القالب", step3:"المحتوى",
    clientName:"اسم العميل / الشركة *", industry:"القطاع *", budget:"الميزانية *",
    currency:"العملة", tone:"الأسلوب", lang:"اللغة", services:"الخدمات المقدمة *",
    challenges:"تحديات العميل", solution:"الحل المقترح", team:"أعضاء الفريق",
    payment:"شروط الدفع", timeline:"الجدول الزمني", notes:"ملاحظات إضافية",
    logoPos:"موضع الشعار", left:"يسار", center:"وسط", right:"يمين",
    next:"التالي →", back:"→ رجوع", generate:"✨ إنشاء العرض",
    generating:"جاري الإنشاء...", download:"⬇️ تحميل PPTX", edit:"✏️ تعديل",
    prev:"→ السابق", tip:"ملف PPTX يفتح في PowerPoint. لـ Google Slides: ملف → استيراد شرائح.",
    professional:"احترافي", friendly:"ودّي", formal:"رسمي",
    english:"الإنجليزية", arabic:"العربية",
  }
};

const CURRENCIES = ["SAR","USD","AED","KWD","QAR","BHD","OMR","EGP"];

const initForm = {
  clientName:"", industry:"", budget:"", currency:"SAR",
  tone:"professional", lang:"english", logoPosition:"left",
  services:"", challenges:"", solution:"", teamMembers:"",
  paymentTerms:"", timeline:"", notes:"",
};

// ── API call via Netlify function ──────────────────────────────────────────
async function callAPI(systemPrompt, userPrompt) {
  const res = await fetch("/.netlify/functions/generate", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ systemPrompt, userPrompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── PPTX Export ────────────────────────────────────────────────────────────
async function exportPPTX(data, tmpl, logoDataUrl, isAr) {
  const prs = new pptxgen();
  prs.layout = "LAYOUT_WIDE";

  const slides = [
    { label: isAr?"الغلاف":"Cover",          type:"cover" },
    { label: isAr?"نبذة عن العميل":"About",   type:"about" },
    { label: isAr?"التحديات":"Challenges",    type:"challenges" },
    { label: isAr?"الحل":"Solution",          type:"solution" },
    { label: isAr?"الخدمات":"Services",       type:"services" },
    { label: isAr?"الفريق":"Team",            type:"team" },
    { label: isAr?"الجدول الزمني":"Timeline", type:"timeline" },
    { label: isAr?"التسعير":"Pricing",        type:"pricing" },
    { label: isAr?"الدفع":"Payment",          type:"payment" },
    { label: isAr?"الخاتمة":"Closing",        type:"closing" },
  ];

  for (const s of slides) {
    const slide = prs.addSlide();
    slide.background = { color: tmpl.bg };
    slide.addShape(prs.ShapeType.rect, { x:0, y:0, w:"100%", h:0.8, fill:{ color: tmpl.primary } });

    if (logoDataUrl) {
      slide.addImage({ data: logoDataUrl, x:0.2, y:0.1, w:1.2, h:0.6 });
    } else {
      slide.addText("SOL", { x:0.2, y:0.1, w:1.2, h:0.6, fontSize:20, bold:true, color:"FFFFFF" });
    }

    const content = data[s.type] || {};

    if (s.type === "cover") {
      slide.addText(content.title || data.companyName || "Proposal", {
        x:1, y:1.5, w:8, h:1.2, fontSize:36, bold:true, color: tmpl.primary, align:"center"
      });
      slide.addText(content.subtitle || "", {
        x:1, y:2.8, w:8, h:0.6, fontSize:18, color: tmpl.secondary, align:"center"
      });
      slide.addText(content.date || new Date().toLocaleDateString(), {
        x:1, y:3.6, w:8, h:0.4, fontSize:12, color:"888888", align:"center"
      });
    } else {
      slide.addText(s.label, {
        x:0.4, y:1.0, w:9, h:0.6, fontSize:22, bold:true, color: tmpl.primary
      });
      slide.addShape(prs.ShapeType.rect, { x:0.4, y:1.65, w:1.5, h:0.05, fill:{ color: tmpl.accent } });

      const bodyText = Array.isArray(content.points)
        ? content.points.map(p => `• ${p}`).join("\n")
        : (content.body || content.description || JSON.stringify(content));

      slide.addText(bodyText, {
        x:0.4, y:1.85, w:9.2, h:3.5, fontSize:13, color:"333333",
        valign:"top", bullet: false, rtlMode: isAr
      });
    }

    slide.addShape(prs.ShapeType.rect, { x:0, y:5.1, w:"100%", h:0.4, fill:{ color: tmpl.primary } });
    slide.addText("SOL for Business Solutions", {
      x:0.2, y:5.15, w:5, h:0.3, fontSize:8, color:"FFFFFF"
    });
  }

  prs.writeFile({ fileName:`SOL_Proposal_${Date.now()}.pptx` });
}

// ── Input components ───────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#444", marginBottom:4 }}>{label}</label>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, style={} }) => (
  <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #ddd", borderRadius:7,
      fontSize:13, boxSizing:"border-box", outline:"none", ...style }} />
);

const Textarea = ({ value, onChange, placeholder, rows=3 }) => (
  <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #ddd", borderRadius:7,
      fontSize:13, boxSizing:"border-box", resize:"vertical", outline:"none" }} />
);

const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={e=>onChange(e.target.value)}
    style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #ddd", borderRadius:7, fontSize:13 }}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [form, setForm] = useState(initForm);
  const [step, setStep] = useState(1);
  const [tmplId, setTmplId] = useState("corporate");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const fileRef = useRef();

  const isAr = form.lang === "arabic";
  const i = isAr ? T.ar : T.en;
  const tmpl = TEMPLATES.find(t=>t.id===tmplId) || TEMPLATES[0];
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setLogoPreview(ev.target.result);
      setLogoDataUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const SLIDE_TYPES = ["cover","about","challenges","solution","services","team","timeline","pricing","payment","closing"];
  const SLIDE_LABELS = isAr
    ? ["الغلاف","نبذة","التحديات","الحل","الخدمات","الفريق","الجدول","التسعير","الدفع","الخاتمة"]
    : ["Cover","About","Challenges","Solution","Services","Team","Timeline","Pricing","Payment","Closing"];

  const generate = async () => {
    if (!form.clientName || !form.industry || !form.budget || !form.services) {
      setError("Please fill all required fields (*)"); return;
    }
    setLoading(true); setError("");
    try {
      const sys = `You are a professional proposal writer for SOL for Business Solutions, a Saudi Arabian consulting company. 
Return ONLY a raw JSON object with no markdown, no backticks, no preamble.
Language: ${form.lang}. Tone: ${form.tone}.
Each slide key must have a "title" and either "body" (string) or "points" (array of strings, max 5).`;

      const usr = `Create a complete business proposal for:
Client: ${form.clientName}
Industry: ${form.industry}
Budget: ${form.currency} ${form.budget}
Services: ${form.services}
Challenges: ${form.challenges || "infer from industry"}
Solution: ${form.solution || "infer best fit"}
Team: ${form.teamMembers || "use typical SOL roles"}
Timeline: ${form.timeline || "propose realistic timeline"}
Payment Terms: ${form.paymentTerms || "50% upfront, 50% on delivery"}
Notes: ${form.notes || "none"}

Return JSON with these exact keys: cover, about, challenges, solution, services, team, timeline, pricing, payment, closing.
Each key has: title (string), and either body (string) or points (string[]).
Also include companyName: "${form.clientName}" at root level.`;

      const result = await callAPI(sys, usr);
      setData(result);
      setActiveSlide(0);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await exportPPTX(data, tmpl, logoDataUrl, isAr); }
    catch(e) { setError(e.message); }
    finally { setExporting(false); }
  };

  const SlidePreview = () => {
    if (!data) return null;
    const key = SLIDE_TYPES[activeSlide];
    const content = data[key] || {};

    return (
      <div style={{ background:`#${tmpl.bg}`, border:`2px solid #${tmpl.primary}20`,
        borderRadius:10, overflow:"hidden", minHeight:260 }}>
        <div style={{ background:`#${tmpl.primary}`, padding:"10px 16px",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {logoPreview
              ? <img src={logoPreview} style={{ height:28, objectFit:"contain", borderRadius:3 }} />
              : <span style={{ color:"#fff", fontWeight:800, fontSize:14 }}>SOL</span>}
          </div>
          <span style={{ color:`#${tmpl.secondary}`, fontSize:11, fontWeight:600 }}>
            {SLIDE_LABELS[activeSlide]}
          </span>
        </div>
        <div style={{ padding:"16px 20px" }}>
          {activeSlide === 0 ? (
            <div style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:22, fontWeight:800, color:`#${tmpl.primary}`, marginBottom:8 }}>
                {content.title || data.companyName}
              </div>
              <div style={{ fontSize:14, color:`#${tmpl.secondary}` }}>{content.subtitle}</div>
              <div style={{ fontSize:11, color:"#888", marginTop:8 }}>
                {new Date().toLocaleDateString()}
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize:15, fontWeight:700, color:`#${tmpl.primary}`, marginBottom:6 }}>
                {content.title}
              </div>
              <div style={{ width:40, height:3, background:`#${tmpl.accent}`, borderRadius:2, marginBottom:10 }} />
              {Array.isArray(content.points)
                ? content.points.map((p,idx) => (
                    <div key={idx} style={{ display:"flex", gap:8, marginBottom:6, fontSize:12, color:"#333" }}>
                      <span style={{ color:`#${tmpl.accent}`, fontWeight:700 }}>•</span>
                      <span>{p}</span>
                    </div>
                  ))
                : <p style={{ fontSize:12, color:"#333", lineHeight:1.6, margin:0 }}>{content.body}</p>
              }
            </>
          )}
        </div>
        <div style={{ background:`#${tmpl.primary}`, padding:"5px 16px" }}>
          <span style={{ color:"#ffffff88", fontSize:9 }}>SOL for Business Solutions</span>
        </div>
      </div>
    );
  };

  const btnStyle = (primary=true) => ({
    padding:"9px 22px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700,
    fontSize:13, background: primary ? `#${tmpl.primary}` : "#f0f0f0",
    color: primary ? "#fff" : "#333"
  });

  return (
    <div style={{ minHeight:"100vh", background:"#f5f6fa", fontFamily:"Arial, sans-serif",
      direction: isAr ? "rtl" : "ltr" }}>
      <div style={{ background:`#${tmpl.primary}`, padding:"14px 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ color:"#fff", fontWeight:800, fontSize:18 }}>{i.title}</div>
        <div style={{ display:"flex", gap:8 }}>
          {["en","ar"].map(l => (
            <button key={l} onClick={()=>set("lang", l==="en"?"english":"arabic")}
              style={{ padding:"4px 12px", borderRadius:20, border:"none", cursor:"pointer",
                background: (l==="en"?form.lang==="english":form.lang==="arabic") ? "#fff" : "transparent",
                color: (l==="en"?form.lang==="english":form.lang==="arabic") ? `#${tmpl.primary}` : "#fff",
                fontWeight:700, fontSize:12 }}>
              {l==="en"?"EN":"ع"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:760, margin:"30px auto", padding:"0 16px" }}>
        {!data && (
          <div style={{ display:"flex", gap:0, marginBottom:24, borderRadius:10, overflow:"hidden",
            border:`1.5px solid #${tmpl.primary}30` }}>
            {[i.step1, i.step2, i.step3].map((s,idx) => (
              <div key={idx} onClick={()=>setStep(idx+1)}
                style={{ flex:1, padding:"10px 0", textAlign:"center", fontSize:12, fontWeight:700,
                  cursor:"pointer",
                  background: step===idx+1 ? `#${tmpl.primary}` : "#fff",
                  color: step===idx+1 ? "#fff" : "#888" }}>
                {`${idx+1}. ${s}`}
              </div>
            ))}
          </div>
        )}

        <div style={{ background:"#fff", borderRadius:14, padding:28,
          boxShadow:"0 2px 16px rgba(0,0,0,.08)" }}>

          {!data && step===1 && (
            <>
              <Field label={i.clientName}>
                <Input value={form.clientName} onChange={v=>set("clientName",v)} placeholder="e.g. Al-Rashid Group" />
              </Field>
              <Field label={i.industry}>
                <Input value={form.industry} onChange={v=>set("industry",v)} placeholder="e.g. Real Estate" />
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label={i.budget}>
                  <Input value={form.budget} onChange={v=>set("budget",v)} placeholder="e.g. 50,000" />
                </Field>
                <Field label={i.currency}>
                  <Select value={form.currency} onChange={v=>set("currency",v)}
                    options={CURRENCIES.map(c=>({value:c,label:c}))} />
                </Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label={i.tone}>
                  <Select value={form.tone} onChange={v=>set("tone",v)} options={[
                    {value:"professional",label:i.professional},
                    {value:"friendly",label:i.friendly},
                    {value:"formal",label:i.formal},
                  ]} />
                </Field>
                <Field label={i.logoPos}>
                  <Select value={form.logoPosition} onChange={v=>set("logoPosition",v)} options={[
                    {value:"left",label:i.left},{value:"center",label:i.center},{value:"right",label:i.right}
                  ]} />
                </Field>
              </div>
              <Field label="Logo (optional)">
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <button onClick={()=>fileRef.current.click()} style={{...btnStyle(false), fontSize:12}}>
                    📎 Upload Logo
                  </button>
                  {logoPreview && <img src={logoPreview} style={{ height:36, objectFit:"contain", borderRadius:4, border:"1px solid #eee" }} />}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogo} />
                </div>
              </Field>
              <div style={{ textAlign:"right", marginTop:8 }}>
                <button onClick={()=>setStep(2)} style={btnStyle()}>{i.next}</button>
              </div>
            </>
          )}

          {!data && step===2 && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
                {TEMPLATES.map(t => (
                  <div key={t.id} onClick={()=>setTmplId(t.id)}
                    style={{ border:`2.5px solid ${tmplId===t.id?`#${t.primary}`:"#e0e0e0"}`,
                      borderRadius:10, padding:14, cursor:"pointer", textAlign:"center",
                      background: tmplId===t.id ? `#${t.bg}` : "#fff",
                      transition:"all .2s" }}>
                    <div style={{ fontSize:26, marginBottom:4 }}>{t.icon}</div>
                    <div style={{ fontWeight:700, fontSize:13, color:`#${t.primary}` }}>
                      {isAr ? t.nameAr : t.name}
                    </div>
                    <div style={{ display:"flex", gap:4, justifyContent:"center", marginTop:6 }}>
                      {[t.primary, t.secondary, t.accent].map((c,i) => (
                        <div key={i} style={{ width:14, height:14, borderRadius:"50%", background:`#${c}` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <button onClick={()=>setStep(1)} style={btnStyle(false)}>{i.back}</button>
                <button onClick={()=>setStep(3)} style={btnStyle()}>{i.next}</button>
              </div>
            </>
          )}

          {!data && step===3 && (
            <>
              <Field label={i.services}>
                <Textarea value={form.services} onChange={v=>set("services",v)}
                  placeholder="e.g. ERP implementation, IT consulting, change management" />
              </Field>
              <Field label={i.challenges}>
                <Textarea value={form.challenges} onChange={v=>set("challenges",v)}
                  placeholder="e.g. Outdated systems, manual processes..." />
              </Field>
              <Field label={i.solution}>
                <Textarea value={form.solution} onChange={v=>set("solution",v)}
                  placeholder="e.g. Implement SAP with 3-phase rollout..." />
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label={i.team}>
                  <Input value={form.teamMembers} onChange={v=>set("teamMembers",v)} placeholder="e.g. PM, BA, Developer" />
                </Field>
                <Field label={i.timeline}>
                  <Input value={form.timeline} onChange={v=>set("timeline",v)} placeholder="e.g. 6 months" />
                </Field>
              </div>
              <Field label={i.payment}>
                <Input value={form.paymentTerms} onChange={v=>set("paymentTerms",v)} placeholder="e.g. 50% upfront, 50% delivery" />
              </Field>
              <Field label={i.notes}>
                <Textarea value={form.notes} onChange={v=>set("notes",v)} placeholder="Any extra context..." rows={2} />
              </Field>
              {error && <div style={{ background:"#fff0f0", border:"1px solid #fcc", borderRadius:8,
                padding:"10px 14px", fontSize:12, color:"#c00", marginBottom:12 }}>{error}</div>}
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <button onClick={()=>setStep(2)} style={btnStyle(false)}>{i.back}</button>
                <button onClick={generate} disabled={loading} style={{
                  ...btnStyle(), opacity: loading ? .7 : 1, cursor: loading ? "not-allowed" : "pointer"
                }}>
                  {loading ? i.generating : i.generate}
                </button>
              </div>
            </>
          )}

          {data && (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontWeight:800, fontSize:16, color:`#${tmpl.primary}` }}>
                  {isAr ? "معاينة العرض" : "Proposal Preview"}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>{setData(null);setStep(1);}} style={btnStyle(false)}>{i.edit}</button>
                  <button onClick={handleExport} disabled={exporting} style={{...btnStyle(), opacity:exporting?.7:1}}>
                    {exporting ? "⏳" : i.download}
                  </button>
                </div>
              </div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:12 }}>
                {SLIDE_LABELS.map((l,idx) => (
                  <button key={idx} onClick={()=>setActiveSlide(idx)}
                    style={{ padding:"4px 10px", borderRadius:20, border:"none", cursor:"pointer",
                      fontSize:11, fontWeight:600,
                      background: activeSlide===idx ? `#${tmpl.primary}` : "#f0f0f0",
                      color: activeSlide===idx ? "#fff" : "#555" }}>
                    {l}
                  </button>
                ))}
              </div>
              <SlidePreview />
              <div style={{ marginTop:10, padding:"8px 12px", background:"#fffbeb",
                borderRadius:8, fontSize:10, color:"#92400e", border:"1px solid #fde68a" }}>
                💡 {i.tip}
              </div>
              {error && <div style={{ marginTop:8, background:"#fff0f0", border:"1px solid #fcc",
                borderRadius:8, padding:"10px 14px", fontSize:12, color:"#c00" }}>{error}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}