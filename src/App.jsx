import { useState, useRef } from "react";
import pptxgen from "pptxgenjs";

const DEFAULT_SECTIONS = [
  { id:"confirmation", label:"Confirmation Letter",                    labelAr:"خطاب التأكيد",       isDivider:true,  slides:1 },
  { id:"executive",    label:"Executive Summary",                      labelAr:"الملخص التنفيذي",    isDivider:false, slides:2 },
  { id:"scope",        label:"Our Understanding of the Scope of Work", labelAr:"فهمنا لنطاق العمل", isDivider:false, slides:2 },
  { id:"plan",         label:"Plan & People",                          labelAr:"الخطة والفريق",      isDivider:false, slides:3 },
  { id:"credentials",  label:"Credentials (WHO ARE WE)",               labelAr:"من نحن",             isDivider:false, slides:2 },
  { id:"appendix",     label:"Appendix",                               labelAr:"الملاحق",            isDivider:true,  slides:1 },
];

const DEFAULT_TEMPLATES = [
  { id:"corporate",  name:"Corporate",   nameAr:"رسمي",    icon:"🏢", primary:"0D1B4B", secondary:"C9A84C", accent:"1A3CFF", bg:"F4F6FB" },
  { id:"creative",   name:"Creative",    nameAr:"إبداعي",  icon:"🎨", primary:"2D1B69", secondary:"FF6B35", accent:"A855F7", bg:"FAF5FF" },
  { id:"minimal",    name:"Minimal",     nameAr:"بسيط",    icon:"⬜", primary:"111111", secondary:"555555", accent:"000000", bg:"FAFAFA" },
  { id:"tech",       name:"Tech",        nameAr:"تقني",    icon:"💻", primary:"0F172A", secondary:"06B6D4", accent:"3B82F6", bg:"F0F9FF" },
  { id:"consulting", name:"Consulting",  nameAr:"استشاري", icon:"📊", primary:"0D3B2E", secondary:"A8C5B5", accent:"10B981", bg:"F0FDF4" },
  { id:"realestate", name:"Real Estate", nameAr:"عقاري",   icon:"🏗️", primary:"2C1810", secondary:"D4A96A", accent:"92400E", bg:"FFFBF5" },
];

const CURRENCIES = ["SAR","USD","AED","KWD","QAR","BHD","OMR","EGP"];

const initForm = {
  clientName:"", industry:"", budget:"", currency:"SAR",
  tone:"professional", lang:"english", logoPosition:"left",
  services:"", challenges:"", solution:"", teamMembers:"",
  paymentTerms:"", timeline:"", notes:"",
};

// ── API ───────────────────────────────────────────────────────────────────
async function callAPI(systemPrompt, userPrompt) {
  const res = await fetch("/.netlify/functions/generate", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ systemPrompt, userPrompt }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||`HTTP ${res.status}`); }
  return res.json();
}

// ── PPTX Export ───────────────────────────────────────────────────────────
async function exportPPTX(data, tmpl, logoDataUrl, sections) {
  const prs = new pptxgen();
  prs.layout = "LAYOUT_WIDE";

  for (const section of sections) {
    const sd = data[section.id] || {};

    if (section.isDivider) {
      const slide = prs.addSlide();
      slide.background = { color: tmpl.primary };
      slide.addShape(prs.ShapeType.rect, { x:0, y:2, w:"100%", h:1.5, fill:{ color: tmpl.accent } });
      slide.addText(section.label, { x:1, y:2.1, w:8, h:0.7, fontSize:32, bold:true, color:"FFFFFF", align:"center" });
      slide.addText(section.labelAr, { x:1, y:2.9, w:8, h:0.5, fontSize:20, color:"FFFFFF", align:"center", rtlMode:true });
      if (logoDataUrl) slide.addImage({ data:logoDataUrl, x:0.2, y:0.1, w:1.2, h:0.6 });
    } else {
      for (let s = 0; s < section.slides; s++) {
        const slide = prs.addSlide();
        slide.background = { color: tmpl.bg };
        slide.addShape(prs.ShapeType.rect, { x:0, y:0, w:"100%", h:0.7, fill:{ color: tmpl.primary } });
        if (logoDataUrl) slide.addImage({ data:logoDataUrl, x:0.2, y:0.05, w:1.0, h:0.55 });
        else slide.addText("SOL", { x:0.2, y:0.1, w:1, h:0.5, fontSize:16, bold:true, color:"FFFFFF" });

        const enPts = sd.points_en || [];
        const arPts = sd.points_ar || [];

        slide.addText(sd.title_en || section.label, { x:0.4, y:0.9, w:4.5, h:0.5, fontSize:16, bold:true, color:tmpl.primary });
        slide.addShape(prs.ShapeType.rect, { x:0.4, y:1.45, w:1.2, h:0.04, fill:{ color:tmpl.accent } });
        enPts.forEach((p,i) => slide.addText(`• ${p}`, { x:0.4, y:1.55+i*0.45, w:4.5, h:0.4, fontSize:11, color:"333333" }));

        slide.addText(sd.title_ar || section.labelAr, { x:5.1, y:0.9, w:4.5, h:0.5, fontSize:16, bold:true, color:tmpl.primary, align:"right", rtlMode:true });
        arPts.forEach((p,i) => slide.addText(`${p} •`, { x:5.1, y:1.55+i*0.45, w:4.5, h:0.4, fontSize:11, color:"333333", align:"right", rtlMode:true }));

        slide.addShape(prs.ShapeType.rect, { x:4.95, y:0.85, w:0.1, h:4.2, fill:{ color: tmpl.accent } });
        slide.addShape(prs.ShapeType.rect, { x:0, y:5.1, w:"100%", h:0.4, fill:{ color:tmpl.primary } });
        slide.addText("SOL for Business Solutions", { x:0.2, y:5.15, w:5, h:0.3, fontSize:8, color:"FFFFFF" });
      }
    }
  }
  prs.writeFile({ fileName:`SOL_Proposal_${Date.now()}.pptx` });
}

// ── UI Helpers ────────────────────────────────────────────────────────────
const Field = ({ label, children }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ display:"block", fontSize:12, fontWeight:600, color:"#444", marginBottom:4 }}>{label}</label>
    {children}
  </div>
);
const Input = ({ value, onChange, placeholder, style={} }) => (
  <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #ddd", borderRadius:7, fontSize:13, boxSizing:"border-box", outline:"none", ...style }} />
);
const Textarea = ({ value, onChange, placeholder, rows=3 }) => (
  <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #ddd", borderRadius:7, fontSize:13, boxSizing:"border-box", resize:"vertical", outline:"none" }} />
);
const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={e=>onChange(e.target.value)}
    style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #ddd", borderRadius:7, fontSize:13 }}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

// ── App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [form, setForm] = useState(initForm);
  const [step, setStep] = useState(1);
  const [tmplId, setTmplId] = useState("corporate");
  const [customColors, setCustomColors] = useState({});
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [activeTab, setActiveTab] = useState("form");
  const [imgPrompt, setImgPrompt] = useState("");
  const [generatedImages, setGeneratedImages] = useState([]);
  const [imgLoading, setImgLoading] = useState(false);
  const [editingColors, setEditingColors] = useState(false);
  const fileRef = useRef();
  const templateFileRef = useRef();

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const isAr = form.lang === "arabic";
  const baseTmpl = DEFAULT_TEMPLATES.find(t=>t.id===tmplId) || DEFAULT_TEMPLATES[0];
  const tmpl = { ...baseTmpl, ...(customColors[tmplId]||{}) };
  const btn = (primary=true) => ({
    padding:"9px 22px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:13,
    background: primary ? `#${tmpl.primary}` : "#f0f0f0", color: primary ? "#fff" : "#333"
  });

  const handleLogo = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => { setLogoPreview(ev.target.result); setLogoDataUrl(ev.target.result); };
    r.readAsDataURL(file);
  };

  // Template upload — accepts JSON with sections and/or colors
  const handleTemplateUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!file.name.endsWith(".json")) { alert("Please upload a .json file"); return; }
    const r = new FileReader();
    r.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        let msg = "Template loaded!\n";
        if (parsed.sections && Array.isArray(parsed.sections)) {
          setSections(parsed.sections);
          msg += `✅ ${parsed.sections.length} sections loaded\n`;
        }
        if (parsed.colors && typeof parsed.colors === "object") {
          setCustomColors(c=>({...c,[tmplId]:parsed.colors}));
          msg += "✅ Custom colors applied\n";
        }
        if (!parsed.sections && !parsed.colors) msg = "⚠️ No sections or colors found in file.";
        alert(msg);
      } catch(err) {
        alert("❌ Could not read file. Make sure it's valid JSON.\n\nError: " + err.message);
      }
    };
    r.readAsText(file);
    // Reset input so same file can be uploaded again
    e.target.value = "";
  };

  const addSection = () => setSections(s=>[...s,{ id:`s_${Date.now()}`, label:"New Section", labelAr:"قسم جديد", isDivider:false, slides:1 }]);
  const removeSection = (id) => setSections(s=>s.filter(x=>x.id!==id));
  const updateSection = (id,k,v) => setSections(s=>s.map(x=>x.id===id?{...x,[k]:v}:x));
  const moveSection = (idx,dir) => setSections(s=>{ const a=[...s],sw=idx+dir; if(sw<0||sw>=a.length) return a; [a[idx],a[sw]]=[a[sw],a[idx]]; return a; });

  // Generate — simplified prompt to avoid JSON errors
  const generate = async () => {
    if (!form.clientName||!form.industry||!form.budget||!form.services) {
      setError("Please fill all required fields (*)"); return;
    }
    setLoading(true); setError("");
    try {
      // Only generate for non-divider sections
      const contentSections = sections.filter(s=>!s.isDivider);
      const sectionIds = contentSections.map(s=>s.id).join(", ");

      const sys = `You are a bilingual proposal writer for SOL for Business Solutions, Saudi Arabia.
Return ONLY a valid JSON object. No markdown, no backticks, no extra text before or after.
Keep bullet points short (max 10 words each). Max 4 bullet points per section.`;

      const usr = `Write a bilingual business proposal (English + Arabic) for:
Client: ${form.clientName}
Industry: ${form.industry}
Budget: ${form.currency} ${form.budget}
Services: ${form.services}
Challenges: ${form.challenges||"typical for this industry"}
Solution: ${form.solution||"best fit solution"}
Team: ${form.teamMembers||"PM, BA, Consultant"}
Timeline: ${form.timeline||"6 months"}
Payment: ${form.paymentTerms||"50% upfront, 50% on delivery"}

Return a JSON object with these keys: ${sectionIds}, companyName.
Each section key has: title_en (string), title_ar (string), points_en (array of max 4 short strings), points_ar (array of max 4 short Arabic strings).
companyName is just "${form.clientName}".
IMPORTANT: Keep all strings short. No special characters. Valid JSON only.`;

      const result = await callAPI(sys, usr);
      setData(result);
      setActiveSlide(0);
      setActiveTab("preview");
    } catch(e) {
      setError("Generation failed: " + e.message);
    } finally { setLoading(false); }
  };

  // Image generation — direct browser call to Pollinations (no API key needed)
  const handleGenerateImage = async () => {
    if (!imgPrompt.trim()) return;
    setImgLoading(true);
    try {
      const encoded = encodeURIComponent(imgPrompt.trim());
      const seed = Math.floor(Math.random()*99999);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=768&seed=${seed}&nologo=true`;
      // Pre-load image to confirm it works
      await new Promise((res,rej) => {
        const img = new Image();
        img.onload = res;
        img.onerror = rej;
        img.src = url;
      });
      setGeneratedImages(imgs=>[{ url, prompt:imgPrompt }, ...imgs]);
    } catch {
      setError("Image generation failed. Please try again with a different prompt.");
    } finally { setImgLoading(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await exportPPTX(data, tmpl, logoDataUrl, sections); }
    catch(e) { setError(e.message); }
    finally { setExporting(false); }
  };

  const flatSlides = sections.flatMap(s =>
    s.isDivider ? [{ ...s, type:"divider" }] :
    Array.from({length:s.slides}, (_,i) => ({ ...s, slideIndex:i, type:"content" }))
  );

  const SlidePreview = () => {
    const slide = flatSlides[activeSlide]; if (!slide) return null;
    const content = data?.[slide.id] || {};
    return (
      <div style={{ background:`#${tmpl.bg}`, border:`2px solid #${tmpl.primary}20`, borderRadius:10, overflow:"hidden", minHeight:280 }}>
        {slide.type==="divider" ? (
          <div style={{ background:`#${tmpl.primary}`, minHeight:280, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
            <div style={{ background:`#${tmpl.accent}`, padding:"12px 32px", borderRadius:6, textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, color:"#fff" }}>{slide.label}</div>
              <div style={{ fontSize:14, color:"#ffffff99", marginTop:4 }}>{slide.labelAr}</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background:`#${tmpl.primary}`, padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              {logoPreview ? <img src={logoPreview} style={{ height:24, objectFit:"contain" }}/> : <span style={{ color:"#fff", fontWeight:800, fontSize:13 }}>SOL</span>}
              <span style={{ color:`#${tmpl.secondary}`, fontSize:11, fontWeight:600 }}>{slide.label}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 4px 1fr", padding:"14px 16px", minHeight:200 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:`#${tmpl.primary}`, marginBottom:6 }}>{content.title_en || slide.label}</div>
                <div style={{ width:30, height:2, background:`#${tmpl.accent}`, marginBottom:8 }}/>
                {(content.points_en||[]).map((p,i)=><div key={i} style={{ fontSize:11, color:"#333", marginBottom:4 }}>• {p}</div>)}
              </div>
              <div style={{ background:`#${tmpl.accent}`, margin:"0 8px" }}/>
              <div dir="rtl">
                <div style={{ fontSize:13, fontWeight:700, color:`#${tmpl.primary}`, marginBottom:6 }}>{content.title_ar || slide.labelAr}</div>
                <div style={{ width:30, height:2, background:`#${tmpl.accent}`, marginBottom:8 }}/>
                {(content.points_ar||[]).map((p,i)=><div key={i} style={{ fontSize:11, color:"#333", marginBottom:4 }}>{p} •</div>)}
              </div>
            </div>
            <div style={{ background:`#${tmpl.primary}`, padding:"4px 14px" }}>
              <span style={{ color:"#ffffff88", fontSize:9 }}>SOL for Business Solutions</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f5f6fa", fontFamily:"Arial, sans-serif", direction:isAr?"rtl":"ltr" }}>
      {/* Top Bar */}
      <div style={{ background:`#${tmpl.primary}`, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={{ color:"#fff", fontWeight:800, fontSize:18 }}>
          {isAr?"مولّد عروض SOL":"SOL Proposal Generator"}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          {/* Language */}
          {["english","arabic"].map(l=>(
            <button key={l} onClick={()=>set("lang",l)}
              style={{ padding:"4px 12px", borderRadius:20, border:"none", cursor:"pointer",
                background:form.lang===l?"#fff":"rgba(255,255,255,0.2)",
                color:form.lang===l?`#${tmpl.primary}`:"#fff", fontWeight:700, fontSize:12 }}>
              {l==="english"?"EN":"ع"}
            </button>
          ))}
          {/* Tabs */}
          {[["form","📝 Form","📝 نموذج"],["sections","📋 Sections","📋 أقسام"],["images","🎨 Images","🎨 صور"]].map(([tab,en,ar])=>(
            <button key={tab} onClick={()=>setActiveTab(tab)}
              style={{ padding:"5px 14px", borderRadius:20, border:"none", cursor:"pointer",
                background:activeTab===tab?"rgba(255,255,255,0.3)":"transparent",
                color:"#fff", fontWeight:activeTab===tab?800:600, fontSize:12,
                borderBottom:activeTab===tab?"2px solid #fff":"none" }}>
              {isAr?ar:en}
            </button>
          ))}
          {data && (
            <button onClick={()=>setActiveTab("preview")}
              style={{ padding:"5px 14px", borderRadius:20, border:"none", cursor:"pointer",
                background:activeTab==="preview"?"rgba(255,255,255,0.3)":"transparent",
                color:"#fff", fontWeight:activeTab==="preview"?800:600, fontSize:12,
                borderBottom:activeTab==="preview"?"2px solid #fff":"none" }}>
              {isAr?"👁 معاينة":"👁 Preview"}
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth:860, margin:"24px auto", padding:"0 16px" }}>

        {/* ── FORM ── */}
        {activeTab==="form" && (
          <div style={{ background:"#fff", borderRadius:14, padding:28, boxShadow:"0 2px 16px rgba(0,0,0,.08)" }}>
            <div style={{ display:"flex", marginBottom:20, borderRadius:10, overflow:"hidden", border:`1.5px solid #${tmpl.primary}30` }}>
              {[isAr?"بيانات العميل":"Client Info", isAr?"القالب":"Template", isAr?"المحتوى":"Content"].map((s,idx)=>(
                <div key={idx} onClick={()=>setStep(idx+1)}
                  style={{ flex:1, padding:"9px 0", textAlign:"center", fontSize:12, fontWeight:700, cursor:"pointer",
                    background:step===idx+1?`#${tmpl.primary}`:"#fff", color:step===idx+1?"#fff":"#888" }}>
                  {idx+1}. {s}
                </div>
              ))}
            </div>

            {step===1 && <>
              <Field label={isAr?"اسم العميل / الشركة *":"Client / Company Name *"}>
                <Input value={form.clientName} onChange={v=>set("clientName",v)} placeholder="e.g. Al-Rashid Group"/>
              </Field>
              <Field label={isAr?"القطاع *":"Industry *"}>
                <Input value={form.industry} onChange={v=>set("industry",v)} placeholder="e.g. Real Estate"/>
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label={isAr?"الميزانية *":"Budget *"}><Input value={form.budget} onChange={v=>set("budget",v)} placeholder="50,000"/></Field>
                <Field label={isAr?"العملة":"Currency"}><Select value={form.currency} onChange={v=>set("currency",v)} options={CURRENCIES.map(c=>({value:c,label:c}))}/></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label={isAr?"الأسلوب":"Tone"}>
                  <Select value={form.tone} onChange={v=>set("tone",v)} options={[
                    {value:"professional",label:isAr?"احترافي":"Professional"},
                    {value:"friendly",label:isAr?"ودّي":"Friendly"},
                    {value:"formal",label:isAr?"رسمي":"Formal"}]}/>
                </Field>
                <Field label={isAr?"موضع الشعار":"Logo Position"}>
                  <Select value={form.logoPosition} onChange={v=>set("logoPosition",v)} options={[
                    {value:"left",label:isAr?"يسار":"Left"},{value:"center",label:isAr?"وسط":"Center"},{value:"right",label:isAr?"يمين":"Right"}]}/>
                </Field>
              </div>
              <Field label={isAr?"الشعار (اختياري)":"Logo (optional)"}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <button onClick={()=>fileRef.current.click()} style={{...btn(false),fontSize:12}}>📎 {isAr?"رفع الشعار":"Upload Logo"}</button>
                  {logoPreview && <img src={logoPreview} style={{ height:36, objectFit:"contain", borderRadius:4, border:"1px solid #eee" }}/>}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogo}/>
                </div>
              </Field>
              <div style={{ textAlign:isAr?"left":"right" }}>
                <button onClick={()=>setStep(2)} style={btn()}>{isAr?"التالي →":"Next →"}</button>
              </div>
            </>}

            {step===2 && <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
                {DEFAULT_TEMPLATES.map(t=>(
                  <div key={t.id} onClick={()=>setTmplId(t.id)}
                    style={{ border:`2.5px solid ${tmplId===t.id?`#${t.primary}`:"#e0e0e0"}`, borderRadius:10, padding:12, cursor:"pointer", textAlign:"center",
                      background:tmplId===t.id?`#${t.bg}`:"#fff" }}>
                    <div style={{ fontSize:24, marginBottom:4 }}>{t.icon}</div>
                    <div style={{ fontWeight:700, fontSize:12, color:`#${t.primary}` }}>{isAr?t.nameAr:t.name}</div>
                    <div style={{ display:"flex", gap:3, justifyContent:"center", marginTop:5 }}>
                      {[t.primary,t.secondary,t.accent].map((c,i)=><div key={i} style={{ width:12,height:12,borderRadius:"50%",background:`#${c}` }}/>)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Color Editor */}
              <div style={{ background:"#f8f9fa", borderRadius:10, padding:14, marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>🎨 {isAr?"تخصيص الألوان":"Customize Colors"}</div>
                  <button onClick={()=>setEditingColors(!editingColors)}
                    style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #ddd", background:"#fff", fontSize:11, cursor:"pointer" }}>
                    {editingColors?(isAr?"تم":"Done"):(isAr?"تعديل":"Edit Colors")}
                  </button>
                </div>
                {editingColors && (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                    {[["primary","Primary"],["secondary","Secondary"],["accent","Accent"],["bg","Background"]].map(([key,label])=>(
                      <div key={key} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:10, color:"#666", marginBottom:4 }}>{label}</div>
                        <input ty