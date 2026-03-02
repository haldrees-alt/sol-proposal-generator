import { useState, useRef } from "react";
import pptxgen from "pptxgenjs";

// ── Default SOL Proposal Structure ────────────────────────────────────────
const DEFAULT_SECTIONS = [
  { id:"confirmation",  label:"Confirmation Letter", labelAr:"خطاب التأكيد", isDivider:true, slides:1 },
  { id:"executive",     label:"Executive Summary",   labelAr:"الملخص التنفيذي", isDivider:false, slides:2 },
  { id:"scope",         label:"Our Understanding of the Scope of Work", labelAr:"فهمنا لنطاق العمل", isDivider:false, slides:2 },
  { id:"plan",          label:"Plan & People",        labelAr:"الخطة والفريق", isDivider:false, slides:3 },
  { id:"credentials",   label:"Credentials (WHO ARE WE)", labelAr:"من نحن", isDivider:false, slides:2 },
  { id:"appendix",      label:"Appendix",             labelAr:"الملاحق", isDivider:true, slides:1 },
];

// ── Templates ──────────────────────────────────────────────────────────────
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
  tone:"professional", lang:"both", logoPosition:"left",
  services:"", challenges:"", solution:"", teamMembers:"",
  paymentTerms:"", timeline:"", notes:"",
};

// ── API ────────────────────────────────────────────────────────────────────
async function callAPI(systemPrompt, userPrompt) {
  const res = await fetch("/.netlify/functions/generate", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ systemPrompt, userPrompt }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||`HTTP ${res.status}`); }
  return res.json();
}

// ── AI Image Generation (via Netlify function) ────────────────────────────
async function generateImage(prompt) {
  const res = await fetch("/.netlify/functions/generate-image", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error("Image generation failed");
  const data = await res.json();
  return data.imageUrl;
}

// ── PPTX Export ────────────────────────────────────────────────────────────
async function exportPPTX(data, tmpl, logoDataUrl, sections) {
  const prs = new pptxgen();
  prs.layout = "LAYOUT_WIDE";

  for (const section of sections) {
    const sectionData = data[section.id] || {};

    if (section.isDivider) {
      // Section Divider Slide
      const divSlide = prs.addSlide();
      divSlide.background = { color: tmpl.primary };
      divSlide.addShape(prs.ShapeType.rect, { x:0, y:2, w:"100%", h:1.5, fill:{ color: tmpl.accent } });
      divSlide.addText(section.label, {
        x:1, y:2.1, w:8, h:0.7, fontSize:32, bold:true, color:"FFFFFF", align:"center"
      });
      divSlide.addText(section.labelAr, {
        x:1, y:2.9, w:8, h:0.5, fontSize:20, color:"FFFFFF", align:"center", rtlMode:true
      });
      if (logoDataUrl) divSlide.addImage({ data:logoDataUrl, x:0.2, y:0.1, w:1.2, h:0.6 });
    } else {
      // Content Slides
      for (let s = 0; s < section.slides; s++) {
        const slide = prs.addSlide();
        slide.background = { color: tmpl.bg };
        slide.addShape(prs.ShapeType.rect, { x:0, y:0, w:"100%", h:0.7, fill:{ color: tmpl.primary } });
        if (logoDataUrl) slide.addImage({ data:logoDataUrl, x:0.2, y:0.05, w:1.0, h:0.55 });
        else slide.addText("SOL", { x:0.2, y:0.1, w:1, h:0.5, fontSize:16, bold:true, color:"FFFFFF" });

        // English side
        slide.addText(sectionData.title_en || section.label, {
          x:0.4, y:0.9, w:4.5, h:0.5, fontSize:16, bold:true, color:tmpl.primary
        });
        slide.addShape(prs.ShapeType.rect, { x:0.4, y:1.45, w:1.2, h:0.04, fill:{ color:tmpl.accent } });
        const enPoints = (sectionData.slides?.[s]?.points_en || sectionData.points_en || []);
        enPoints.forEach((p,i) => {
          slide.addText(`• ${p}`, { x:0.4, y:1.55+i*0.45, w:4.5, h:0.4, fontSize:11, color:"333333" });
        });

        // Arabic side
        slide.addShape(prs.ShapeType.rect, { x:5.1, y:0.9, w:4.5, h:0.5, fill:{ color:`${tmpl.primary}22` } });
        slide.addText(sectionData.title_ar || section.labelAr, {
          x:5.1, y:0.9, w:4.5, h:0.5, fontSize:16, bold:true, color:tmpl.primary, align:"right", rtlMode:true
        });
        const arPoints = (sectionData.slides?.[s]?.points_ar || sectionData.points_ar || []);
        arPoints.forEach((p,i) => {
          slide.addText(`${p} •`, { x:5.1, y:1.55+i*0.45, w:4.5, h:0.4, fontSize:11, color:"333333", align:"right", rtlMode:true });
        });

        // Center divider
        slide.addShape(prs.ShapeType.rect, { x:4.95, y:0.85, w:0.1, h:4.2, fill:{ color:`${tmpl.accent}` } });

        // Footer
        slide.addShape(prs.ShapeType.rect, { x:0, y:5.1, w:"100%", h:0.4, fill:{ color:tmpl.primary } });
        slide.addText("SOL for Business Solutions", { x:0.2, y:5.15, w:5, h:0.3, fontSize:8, color:"FFFFFF" });
        slide.addText(`${section.label} | ${s+1}`, { x:5, y:5.15, w:4.5, h:0.3, fontSize:8, color:"FFFFFF", align:"right" });
      }
    }
  }

  prs.writeFile({ fileName:`SOL_Proposal_${Date.now()}.pptx` });
}

// ── UI Components ──────────────────────────────────────────────────────────
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

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [form, setForm] = useState(initForm);
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
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
  const baseTmpl = templates.find(t=>t.id===tmplId) || templates[0];
  const tmpl = { ...baseTmpl, ...(customColors[tmplId]||{}) };

  const btnStyle = (primary=true, color=tmpl.primary) => ({
    padding:"9px 22px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700,
    fontSize:13, background: primary ? `#${color}` : "#f0f0f0", color: primary ? "#fff" : "#333"
  });

  // Logo upload
  const handleLogo = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setLogoPreview(ev.target.result); setLogoDataUrl(ev.target.result); };
    reader.readAsDataURL(file);
  };

  // Template file upload (JSON structure)
  const handleTemplateUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.sections) setSections(parsed.sections);
        if (parsed.colors) setCustomColors(c=>({...c,[tmplId]:parsed.colors}));
        alert("Template loaded successfully!");
      } catch { alert("Invalid template file. Please upload a valid JSON template."); }
    };
    reader.readAsText(file);
  };

  // Section management
  const addSection = () => {
    setSections(s=>[...s, {
      id:`custom_${Date.now()}`, label:"New Section", labelAr:"قسم جديد", isDivider:false, slides:1
    }]);
  };
  const removeSection = (id) => setSections(s=>s.filter(s=>s.id!==id));
  const updateSection = (id, key, val) => setSections(s=>s.map(s=>s.id===id?{...s,[key]:val}:s));
  const moveSection = (idx, dir) => {
    setSections(s=>{
      const arr=[...s]; const swap=idx+dir;
      if(swap<0||swap>=arr.length) return arr;
      [arr[idx],arr[swap]]=[arr[swap],arr[idx]]; return arr;
    });
  };

  // Generate proposal
  const generate = async () => {
    if (!form.clientName||!form.industry||!form.budget||!form.services) {
      setError("Please fill all required fields (*)"); return;
    }
    setLoading(true); setError("");
    try {
      const sectionList = sections.map(s=>`${s.id}: "${s.label}" / "${s.labelAr}" (${s.slides} slide${s.slides>1?"s":""}${s.isDivider?" - DIVIDER":""})`).join("\n");
      const sys = `You are a professional bilingual proposal writer for SOL for Business Solutions, Saudi Arabia.
Return ONLY raw JSON. No markdown, no backticks.
Generate content for EVERY section provided. Each section key must have:
- title_en, title_ar
- points_en: array of ${`3-5`} English bullet points
- points_ar: array of matching Arabic bullet points
- If section has multiple slides, include a "slides" array with one object per slide, each having points_en and points_ar
Tone: ${form.tone}`;

      const usr = `Create a complete bilingual proposal for:
Client: ${form.clientName} | Industry: ${form.industry} | Budget: ${form.currency} ${form.budget}
Services: ${form.services}
Challenges: ${form.challenges||"infer"}
Solution: ${form.solution||"infer"}
Team: ${form.teamMembers||"typical SOL roles"}
Timeline: ${form.timeline||"realistic"}
Payment: ${form.paymentTerms||"50% upfront, 50% delivery"}
Notes: ${form.notes||"none"}

Generate content for these sections:
${sectionList}

Return JSON where each key matches the section id above.
Also include companyName: "${form.clientName}" at root.`;

      const result = await callAPI(sys, usr);
      setData(result); setActiveSlide(0); setActiveTab("preview");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // AI Image generation
  const handleGenerateImage = async () => {
    if (!imgPrompt) return;
    setImgLoading(true);
    try {
      const url = await generateImage(imgPrompt);
      setGeneratedImages(imgs=>[{url, prompt:imgPrompt}, ...imgs]);
    } catch(e) { setError("Image generation failed: "+e.message); }
    finally { setImgLoading(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await exportPPTX(data, tmpl, logoDataUrl, sections); }
    catch(e) { setError(e.message); }
    finally { setExporting(false); }
  };

  // ── Flat slides list for preview
  const flatSlides = sections.flatMap(s => {
    if (s.isDivider) return [{ ...s, type:"divider" }];
    return Array.from({length:s.slides}, (_,i) => ({ ...s, slideIndex:i, type:"content" }));
  });

  const SlidePreview = () => {
    const slide = flatSlides[activeSlide]; if (!slide) return null;
    const content = data?.[slide.id] || {};
    const enPoints = slide.type==="divider" ? [] : (content.slides?.[slide.slideIndex||0]?.points_en || content.points_en || []);
    const arPoints = slide.type==="divider" ? [] : (content.slides?.[slide.slideIndex||0]?.points_ar || content.points_ar || []);

    return (
      <div style={{ background:`#${tmpl.bg}`, border:`2px solid #${tmpl.primary}20`, borderRadius:10, overflow:"hidden", minHeight:280 }}>
        {slide.type==="divider" ? (
          <div style={{ background:`#${tmpl.primary}`, minHeight:280, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
            <div style={{ background:`#${tmpl.accent}`, padding:"10px 30px", borderRadius:4 }}>
              <div style={{ fontSize:22, fontWeight:800, color:"#fff" }}>{slide.label}</div>
            </div>
            <div style={{ fontSize:16, color:"#ffffff99" }}>{slide.labelAr}</div>
          </div>
        ) : (
          <>
            <div style={{ background:`#${tmpl.primary}`, padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              {logoPreview ? <img src={logoPreview} style={{ height:24, objectFit:"contain" }}/> : <span style={{ color:"#fff", fontWeight:800 }}>SOL</span>}
              <span style={{ color:`#${tmpl.secondary}`, fontSize:11, fontWeight:600 }}>{slide.label}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 4px 1fr", gap:0, padding:"14px 16px", minHeight:200 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:`#${tmpl.primary}`, marginBottom:6 }}>{content.title_en || slide.label}</div>
                <div style={{ width:30, height:2, background:`#${tmpl.accent}`, marginBottom:8 }}/>
                {enPoints.map((p,i)=><div key={i} style={{ fontSize:11, color:"#333", marginBottom:4 }}>• {p}</div>)}
              </div>
              <div style={{ background:`#${tmpl.accent}`, margin:"0 8px" }}/>
              <div dir="rtl">
                <div style={{ fontSize:13, fontWeight:700, color:`#${tmpl.primary}`, marginBottom:6 }}>{content.title_ar || slide.labelAr}</div>
                <div style={{ width:30, height:2, background:`#${tmpl.accent}`, marginBottom:8, marginRight:0 }}/>
                {arPoints.map((p,i)=><div key={i} style={{ fontSize:11, color:"#333", marginBottom:4 }}>{p} •</div>)}
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
    <div style={{ minHeight:"100vh", background:"#f5f6fa", fontFamily:"Arial, sans-serif" }}>
      {/* Top Bar */}
      <div style={{ background:`#${tmpl.primary}`, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ color:"#fff", fontWeight:800, fontSize:18 }}>SOL Proposal Generator</div>
        <div style={{ display:"flex", gap:8 }}>
          {["form","sections","images"].map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)}
              style={{ padding:"5px 14px", borderRadius:20, border:"none", cursor:"pointer",
                background:activeTab===tab?"#fff":"transparent",
                color:activeTab===tab?`#${tmpl.primary}`:"#fff", fontWeight:700, fontSize:12 }}>
              {tab==="form"?"📝 Form":tab==="sections"?"📋 Sections":"🎨 Images"}
            </button>
          ))}
          {data && <button onClick={()=>setActiveTab("preview")}
            style={{ padding:"5px 14px", borderRadius:20, border:"none", cursor:"pointer",
              background:activeTab==="preview"?"#fff":"transparent",
              color:activeTab==="preview"?`#${tmpl.primary}`:"#fff", fontWeight:700, fontSize:12 }}>
            👁 Preview
          </button>}
        </div>
      </div>

      <div style={{ maxWidth:860, margin:"24px auto", padding:"0 16px" }}>

        {/* ── FORM TAB ── */}
        {activeTab==="form" && (
          <div style={{ background:"#fff", borderRadius:14, padding:28, boxShadow:"0 2px 16px rgba(0,0,0,.08)" }}>
            {/* Step tabs */}
            <div style={{ display:"flex", marginBottom:20, borderRadius:10, overflow:"hidden", border:`1.5px solid #${tmpl.primary}30` }}>
              {["Client Info","Template","Content"].map((s,idx)=>(
                <div key={idx} onClick={()=>setStep(idx+1)}
                  style={{ flex:1, padding:"9px 0", textAlign:"center", fontSize:12, fontWeight:700, cursor:"pointer",
                    background:step===idx+1?`#${tmpl.primary}`:"#fff", color:step===idx+1?"#fff":"#888" }}>
                  {idx+1}. {s}
                </div>
              ))}
            </div>

            {/* Step 1 */}
            {step===1 && <>
              <Field label="Client / Company Name *">
                <Input value={form.clientName} onChange={v=>set("clientName",v)} placeholder="e.g. Al-Rashid Group"/>
              </Field>
              <Field label="Industry *">
                <Input value={form.industry} onChange={v=>set("industry",v)} placeholder="e.g. Real Estate"/>
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Budget *"><Input value={form.budget} onChange={v=>set("budget",v)} placeholder="e.g. 50,000"/></Field>
                <Field label="Currency"><Select value={form.currency} onChange={v=>set("currency",v)} options={CURRENCIES.map(c=>({value:c,label:c}))}/></Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Tone">
                  <Select value={form.tone} onChange={v=>set("tone",v)} options={[{value:"professional",label:"Professional"},{value:"friendly",label:"Friendly"},{value:"formal",label:"Formal"}]}/>
                </Field>
                <Field label="Logo Position">
                  <Select value={form.logoPosition} onChange={v=>set("logoPosition",v)} options={[{value:"left",label:"Left"},{value:"center",label:"Center"},{value:"right",label:"Right"}]}/>
                </Field>
              </div>
              <Field label="Logo (optional)">
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <button onClick={()=>fileRef.current.click()} style={{...btnStyle(false), fontSize:12}}>📎 Upload Logo</button>
                  {logoPreview && <img src={logoPreview} style={{ height:36, objectFit:"contain", borderRadius:4, border:"1px solid #eee" }}/>}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogo}/>
                </div>
              </Field>
              <div style={{ textAlign:"right" }}>
                <button onClick={()=>setStep(2)} style={btnStyle()}>Next →</button>
              </div>
            </>}

            {/* Step 2 - Template + Color Editor */}
            {step===2 && <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
                {templates.map(t=>(
                  <div key={t.id} onClick={()=>setTmplId(t.id)}
                    style={{ border:`2.5px solid ${tmplId===t.id?`#${t.primary}`:"#e0e0e0"}`, borderRadius:10, padding:12, cursor:"pointer", textAlign:"center",
                      background:tmplId===t.id?`#${t.bg}`:"#fff" }}>
                    <div style={{ fontSize:24, marginBottom:4 }}>{t.icon}</div>
                    <div style={{ fontWeight:700, fontSize:12, color:`#${t.primary}` }}>{t.name}</div>
                    <div style={{ fontSize:10, color:"#888" }}>{t.nameAr}</div>
                    <div style={{ display:"flex", gap:3, justifyContent:"center", marginTop:5 }}>
                      {[t.primary, t.secondary, t.accent].map((c,i)=>(
                        <div key={i} style={{ width:12, height:12, borderRadius:"50%", background:`#${c}` }}/>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Color Editor */}
              <div style={{ background:"#f8f9fa", borderRadius:10, padding:14, marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>🎨 Customize Colors</div>
                  <button onClick={()=>setEditingColors(!editingColors)}
                    style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #ddd", background:"#fff", fontSize:11, cursor:"pointer" }}>
                    {editingColors?"Done":"Edit Colors"}
                  </button>
                </div>
                {editingColors && (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                    {[["primary","Primary"],["secondary","Secondary"],["accent","Accent"],["bg","Background"]].map(([key,label])=>(
                      <div key={key} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:10, color:"#666", marginBottom:4 }}>{label}</div>
                        <input type="color" value={`#${(customColors[tmplId]?.[key]||baseTmpl[key])}`}
                          onChange={e=>setCustomColors(c=>({...c,[tmplId]:{...(c[tmplId]||{}), [key]:e.target.value.replace("#","")}}))}
                          style={{ width:40, height:32, border:"none", borderRadius:6, cursor:"pointer" }}/>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload custom template */}
              <div style={{ background:"#f0f9ff", borderRadius:10, padding:14, marginBottom:16, border:"1px dashed #06B6D4" }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>📁 Upload Template JSON (optional)</div>
                <div style={{ fontSize:11, color:"#666", marginBottom:8 }}>Upload a JSON file to customize sections and colors</div>
                <button onClick={()=>templateFileRef.current.click()} style={{...btnStyle(false), fontSize:12}}>Upload Template</button>
                <input ref={templateFileRef} type="file" accept=".json" style={{ display:"none" }} onChange={handleTemplateUpload}/>
              </div>

              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <button onClick={()=>setStep(1)} style={btnStyle(false)}>← Back</button>
                <button onClick={()=>setStep(3)} style={btnStyle()}>Next →</button>
              </div>
            </>}

            {/* Step 3 */}
            {step===3 && <>
              <Field label="Services Offered *">
                <Textarea value={form.services} onChange={v=>set("services",v)} placeholder="e.g. ERP implementation, IT consulting"/>
              </Field>
              <Field label="Client Challenges">
                <Textarea value={form.challenges} onChange={v=>set("challenges",v)} placeholder="e.g. Outdated systems..."/>
              </Field>
              <Field label="Proposed Solution">
                <Textarea value={form.solution} onChange={v=>set("solution",v)} placeholder="e.g. SAP implementation..."/>
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Team Members"><Input value={form.teamMembers} onChange={v=>set("teamMembers",v)} placeholder="e.g. PM, BA, Developer"/></Field>
                <Field label="Timeline"><Input value={form.timeline} onChange={v=>set("timeline",v)} placeholder="e.g. 6 months"/></Field>
              </div>
              <Field label="Payment Terms">
                <Input value={form.paymentTerms} onChange={v=>set("paymentTerms",v)} placeholder="e.g. 50% upfront, 50% delivery"/>
              </Field>
              <Field label="Additional Notes">
                <Textarea value={form.notes} onChange={v=>set("notes",v)} rows={2} placeholder="Any extra context..."/>
              </Field>
              {error && <div style={{ background:"#fff0f0", border:"1px solid #fcc", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#c00", marginBottom:12 }}>{error}</div>}
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <button onClick={()=>setStep(2)} style={btnStyle(false)}>← Back</button>
                <button onClick={generate} disabled={loading} style={{...btnStyle(), opacity:loading?.7:1}}>
                  {loading?"⏳ Generating...":"✨ Generate Proposal"}
                </button>
              </div>
            </>}
          </div>
        )}

        {/* ── SECTIONS TAB ── */}
        {activeTab==="sections" && (
          <div style={{ background:"#fff", borderRadius:14, padding:28, boxShadow:"0 2px 16px rgba(0,0,0,.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontWeight:800, fontSize:16 }}>📋 Proposal Sections</div>
              <button onClick={addSection} style={btnStyle()}>+ Add Section</button>
            </div>
            <div style={{ fontSize:11, color:"#888", marginBottom:16 }}>
              Drag sections to reorder. Toggle "Divider" to make a section a visual separator slide.
            </div>
            {sections.map((s,idx)=>(
              <div key={s.id} style={{ border:"1.5px solid #e0e0e0", borderRadius:10, padding:14, marginBottom:10,
                background:s.isDivider?`#${tmpl.primary}08`:"#fff" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto auto auto", gap:8, alignItems:"center" }}>
                  <input value={s.label} onChange={e=>updateSection(s.id,"label",e.target.value)}
                    style={{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:6, fontSize:12 }} placeholder="English label"/>
                  <input value={s.labelAr} onChange={e=>updateSection(s.id,"labelAr",e.target.value)}
                    style={{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:6, fontSize:12, direction:"rtl" }} placeholder="التسمية العربية"/>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <div style={{ fontSize:9, color:"#888" }}>Slides</div>
                    <input type="number" min="1" max="10" value={s.slides}
                      onChange={e=>updateSection(s.id,"slides",parseInt(e.target.value)||1)}
                      style={{ width:50, padding:"5px", border:"1px solid #ddd", borderRadius:6, fontSize:12, textAlign:"center" }}/>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                    <div style={{ fontSize:9, color:"#888" }}>Divider</div>
                    <input type="checkbox" checked={s.isDivider} onChange={e=>updateSection(s.id,"isDivider",e.target.checked)}
                      style={{ width:16, height:16, cursor:"pointer" }}/>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    <button onClick={()=>moveSection(idx,-1)} disabled={idx===0}
                      style={{ padding:"2px 6px", border:"1px solid #ddd", borderRadius:4, fontSize:10, cursor:"pointer", opacity:idx===0?.4:1 }}>↑</button>
                    <button onClick={()=>moveSection(idx,1)} disabled={idx===sections.length-1}
                      style={{ padding:"2px 6px", border:"1px solid #ddd", borderRadius:4, fontSize:10, cursor:"pointer", opacity:idx===sections.length-1?.4:1 }}>↓</button>
                  </div>
                  <button onClick={()=>removeSection(s.id)}
                    style={{ padding:"4px 8px", border:"none", borderRadius:6, background:"#fff0f0", color:"#c00", fontSize:12, cursor:"pointer" }}>✕</button>
                </div>
              </div>
            ))}
            <div style={{ marginTop:16, padding:"10px 14px", background:"#fffbeb", borderRadius:8, fontSize:11, color:"#92400e", border:"1px solid #fde68a" }}>
              💡 Default structure follows SOL's standard: Confirmation Letter → Executive Summary → Scope → Plan & People → Credentials → Appendix
            </div>
          </div>
        )}

        {/* ── IMAGES TAB ── */}
        {activeTab==="images" && (
          <div style={{ background:"#fff", borderRadius:14, padding:28, boxShadow:"0 2px 16px rgba(0,0,0,.08)" }}>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>🎨 AI Image Generator</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:20 }}>Generate images to use in your proposals</div>
            <div style={{ display:"flex", gap:10, marginBottom:20 }}>
              <input value={imgPrompt} onChange={e=>setImgPrompt(e.target.value)}
                placeholder="e.g. Professional business team meeting in modern office, Saudi Arabia"
                style={{ flex:1, padding:"10px 14px", border:"1.5px solid #ddd", borderRadius:8, fontSize:13, outline:"none" }}/>
              <button onClick={handleGenerateImage} disabled={imgLoading||!imgPrompt} style={{...btnStyle(), opacity:imgLoading?.7:1}}>
                {imgLoading?"⏳ Generating...":"✨ Generate"}
              </button>
            </div>
            {generatedImages.length===0 && (
              <div style={{ textAlign:"center", padding:"40px 0", color:"#aaa", fontSize:13 }}>
                No images generated yet. Enter a prompt above to get started!
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
              {generatedImages.map((img,i)=>(
                <div key={i} style={{ border:"1px solid #eee", borderRadius:10, overflow:"hidden" }}>
                  <img src={img.url} alt={img.prompt} style={{ width:"100%", height:180, objectFit:"cover" }}/>
                  <div style={{ padding:"8px 10px", fontSize:10, color:"#666" }}>{img.prompt}</div>
                  <div style={{ padding:"0 10px 10px" }}>
                    <a href={img.url} download={`sol-image-${i}.png`}
                      style={{ fontSize:11, color:`#${tmpl.primary}`, fontWeight:600, textDecoration:"none" }}>
                      ⬇️ Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
            {error && <div style={{ marginTop:12, background:"#fff0f0", border:"1px solid #fcc", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#c00" }}>{error}</div>}
          </div>
        )}

        {/* ── PREVIEW TAB ── */}
        {activeTab==="preview" && data && (
          <div style={{ background:"#fff", borderRadius:14, padding:28, boxShadow:"0 2px 16px rgba(0,0,0,.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:16, color:`#${tmpl.primary}` }}>Proposal Preview</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>{setData(null);setActiveTab("form");setStep(1);}} style={btnStyle(false)}>✏️ Edit</button>
                <button onClick={handleExport} disabled={exporting} style={{...btnStyle(), opacity:exporting?.7:1}}>
                  {exporting?"⏳":"⬇️ Download PPTX"}
                </button>
              </div>
            </div>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:12 }}>
              {flatSlides.map((s,idx)=>(
                <button key={idx} onClick={()=>setActiveSlide(idx)}
                  style={{ padding:"3px 8px", borderRadius:20, border:"none", cursor:"pointer", fontSize:10, fontWeight:600,
                    background:activeSlide===idx?`#${tmpl.primary}`:s.type==="divider"?`#${tmpl.accent}22`:"#f0f0f0",
                    color:activeSlide===idx?"#fff":s.type==="divider"?`#${tmpl.accent}`:"#555" }}>
                  {s.type==="divider"?"§ ":""}{s.label.split(" ").slice(0,2).join(" ")}
                </button>
              ))}
            </div>
            <SlidePreview/>
            <div style={{ marginTop:10, padding:"8px 12px", background:"#fffbeb", borderRadius:8, fontSize:10, color:"#92400e", border:"1px solid #fde68a" }}>
              💡 PPTX opens in PowerPoint. For Google Slides: File → Import Slides → Upload .pptx
            </div>
            {error && <div style={{ marginTop:8, background:"#fff0f0", border:"1px solid #fcc", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#c00" }}>{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}