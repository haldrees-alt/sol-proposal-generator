import { useState, useRef, useEffect, useCallback } from "react";
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
const SLIDE_W = 10, SLIDE_H = 5.625; // pptx inches (16:9)

const initForm = {
  clientName:"", industry:"", budget:"", currency:"SAR",
  tone:"professional", lang:"english", logoPosition:"left",
  services:"", challenges:"", solution:"", teamMembers:"",
  paymentTerms:"", timeline:"", notes:"",
};

async function callAPI(systemPrompt, userPrompt) {
  const res = await fetch("/.netlify/functions/generate", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ systemPrompt, userPrompt }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||`HTTP ${res.status}`); }
  return res.json();
}

async function exportPPTX(data, tmpl, logoDataUrl, sections, selectedImage, pdfPages, slideBoxes) {
  const prs = new pptxgen();
  prs.layout = "LAYOUT_WIDE";
  const usePdf = pdfPages && pdfPages.length > 0;

  // build flat slide list same order as UI
  const flatSlides = sections.flatMap(s =>
    s.isDivider ? [{ ...s, type:"divider" }] :
    Array.from({length:s.slides}, (_,i) => ({ ...s, slideIndex:i, type:"content" }))
  );

  for (let si = 0; si < flatSlides.length; si++) {
    const section = flatSlides[si];
    const sd = data[section.id] || {};
    const slide = prs.addSlide();

    // background
    if (usePdf) {
      const bgIdx = Math.min(si, pdfPages.length - 1);
      slide.background = { data: pdfPages[bgIdx] };
    } else {
      slide.background = { color: section.type === "divider" ? tmpl.primary : tmpl.bg };
    }

    if (section.type === "divider") {
      if (!usePdf) {
        if (selectedImage) {
          try { slide.addImage({ data: selectedImage, x:0, y:0, w:"100%", h:"100%", transparency:75 }); } catch(e) {}
        }
        slide.addShape(prs.ShapeType.rect, { x:0, y:2, w:"100%", h:1.5, fill:{ color: tmpl.accent } });
        slide.addText(section.label,   { x:1, y:2.1, w:8, h:0.7, fontSize:32, bold:true, color:"FFFFFF", align:"center" });
        slide.addText(section.labelAr, { x:1, y:2.9, w:8, h:0.5, fontSize:20, color:"FFFFFF", align:"center", rtlMode:true });
        if (logoDataUrl) slide.addImage({ data:logoDataUrl, x:0.2, y:0.1, w:1.2, h:0.6 });
      }
      // if pdf, divider slide just shows the pdf page as-is
    } else {
      const box = usePdf ? (slideBoxes[si] || null) : null;
      const enPts = sd.points_en || [];
      const arPts = sd.points_ar || [];

      if (usePdf && box) {
        // Convert box from preview % coords to pptx inches
        const bx = box.x * SLIDE_W;
        const by = box.y * SLIDE_H;
        const bw = box.w * SLIDE_W;
        const bh = box.h * SLIDE_H;
        const half = bw / 2 - 0.1;

        // semi-transparent overlay
        slide.addShape(prs.ShapeType.rect, { x:bx, y:by, w:bw, h:bh,
          fill:{ color:"FFFFFF", transparency:20 }, line:{ color:"FFFFFF", width:0 } });

        // EN left half
        slide.addText(sd.title_en || section.label, { x:bx+0.1, y:by+0.1, w:half, h:0.4, fontSize:13, bold:true, color:"000000" });
        enPts.forEach((p,i) => slide.addText(`• ${p}`, { x:bx+0.1, y:by+0.6+i*0.38, w:half, h:0.35, fontSize:10, color:"111111" }));

        // divider line
        slide.addShape(prs.ShapeType.rect, { x:bx+half+0.1, y:by+0.1, w:0.02, h:bh-0.2, fill:{ color:"888888" } });

        // AR right half
        slide.addText(sd.title_ar || section.labelAr, { x:bx+half+0.2, y:by+0.1, w:half, h:0.4, fontSize:13, bold:true, color:"000000", align:"right", rtlMode:true });
        arPts.forEach((p,i) => slide.addText(`${p} •`, { x:bx+half+0.2, y:by+0.6+i*0.38, w:half, h:0.35, fontSize:10, color:"111111", align:"right", rtlMode:true }));

      } else if (!usePdf) {
        // built-in template layout
        slide.addShape(prs.ShapeType.rect, { x:0, y:0, w:"100%", h:0.7, fill:{ color: tmpl.primary } });
        if (logoDataUrl) slide.addImage({ data:logoDataUrl, x:0.2, y:0.05, w:1.0, h:0.55 });
        else slide.addText("SOL", { x:0.2, y:0.1, w:1, h:0.5, fontSize:16, bold:true, color:"FFFFFF" });

        slide.addText(sd.title_en || section.label, { x:0.4, y:0.9, w:4.5, h:0.5, fontSize:16, bold:true, color:tmpl.primary });
        slide.addShape(prs.ShapeType.rect, { x:0.4, y:1.45, w:1.2, h:0.04, fill:{ color: tmpl.accent } });
        enPts.forEach((p,i) => slide.addText(`• ${p}`, { x:0.4, y:1.55+i*0.45, w:4.5, h:0.4, fontSize:11, color:"333333" }));

        slide.addText(sd.title_ar || section.labelAr, { x:5.1, y:0.9, w:4.5, h:0.5, fontSize:16, bold:true, color:tmpl.primary, align:"right", rtlMode:true });
        arPts.forEach((p,i) => slide.addText(`${p} •`, { x:5.1, y:1.55+i*0.45, w:4.5, h:0.4, fontSize:11, color:"333333", align:"right", rtlMode:true }));

        slide.addShape(prs.ShapeType.rect, { x:4.95, y:1.4, w:0.05, h:3.5, fill:{ color: tmpl.accent } });
        slide.addShape(prs.ShapeType.rect, { x:0, y:5.1, w:"100%", h:0.4, fill:{ color:tmpl.primary } });
        slide.addText("SOL for Business Solutions", { x:0.2, y:5.15, w:5, h:0.3, fontSize:8, color:"FFFFFF" });
      }
    }
  }
  prs.writeFile({ fileName:`SOL_Proposal_${Date.now()}.pptx` });
}

// PDF to images using canvas
async function pdfToImages(file) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = async () => {
      try {
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const images = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
          images.push(canvas.toDataURL("image/jpeg", 0.92));
        }
        resolve(images);
      } catch(e) { reject(e); }
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js"));
    if (!window.pdfjsLib) document.head.appendChild(script);
    else script.onload();
  });
}

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

// Drag-to-draw text box on a slide preview
function SlideBoxEditor({ imgSrc, box, onChange, slideIndex }) {
  const canvasRef = useRef();
  const dragging = useRef(false);
  const startPt = useRef({});
  const [localBox, setLocalBox] = useState(box || null);

  const getPos = (e, el) => {
    const r = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height };
  };

  const onMouseDown = e => {
    const el = canvasRef.current;
    const pos = getPos(e, el);
    dragging.current = true;
    startPt.current = pos;
    setLocalBox(null);
  };

  const onMouseMove = e => {
    if (!dragging.current) return;
    const pos = getPos(e, canvasRef.current);
    const x = Math.min(startPt.current.x, pos.x);
    const y = Math.min(startPt.current.y, pos.y);
    const w = Math.abs(pos.x - startPt.current.x);
    const h = Math.abs(pos.y - startPt.current.y);
    setLocalBox({ x, y, w, h });
  };

  const onMouseUp = () => {
    dragging.current = false;
    if (localBox && localBox.w > 0.05 && localBox.h > 0.05) onChange(slideIndex, localBox);
  };

  return (
    <div style={{ position:"relative", userSelect:"none", cursor:"crosshair" }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      onTouchStart={onMouseDown} onTouchMove={onMouseMove} onTouchEnd={onMouseUp}>
      <img ref={canvasRef} src={imgSrc} style={{ width:"100%", display:"block", borderRadius:6 }} draggable={false}/>
      {localBox && (
        <div style={{
          position:"absolute",
          left:`${localBox.x*100}%`, top:`${localBox.y*100}%`,
          width:`${localBox.w*100}%`, height:`${localBox.h*100}%`,
          border:"2.5px dashed #2563eb", background:"rgba(37,99,235,0.12)",
          borderRadius:4, pointerEvents:"none"
        }}>
          <span style={{ position:"absolute", top:2, left:4, fontSize:9, color:"#2563eb", fontWeight:700 }}>Text Area</span>
        </div>
      )}
      {!localBox && box && (
        <div style={{
          position:"absolute",
          left:`${box.x*100}%`, top:`${box.y*100}%`,
          width:`${box.w*100}%`, height:`${box.h*100}%`,
          border:"2.5px solid #16a34a", background:"rgba(22,163,74,0.1)",
          borderRadius:4, pointerEvents:"none"
        }}>
          <span style={{ position:"absolute", top:2, left:4, fontSize:9, color:"#16a34a", fontWeight:700 }}>✓ Set</span>
        </div>
      )}
    </div>
  );
}

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
  const [editingColors, setEditingColors] = useState(false);
  const [imgPrompt, setImgPrompt] = useState("");
  const [generatedImages, setGeneratedImages] = useState([]);
  const [imgLoading, setImgLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  // PDF template state
  const [pdfPages, setPdfPages] = useState([]); // array of dataURL strings
  const [pdfName, setPdfName] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [slideBoxes, setSlideBoxes] = useState({}); // { slideIndex: {x,y,w,h} }
  const [editingPdf, setEditingPdf] = useState(false);

  const fileRef = useRef();
  const pdfFileRef = useRef();

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const isAr = form.lang === "arabic";
  const baseTmpl = DEFAULT_TEMPLATES.find(t=>t.id===tmplId) || DEFAULT_TEMPLATES[0];
  const tmpl = { ...baseTmpl, ...(customColors[tmplId]||{}) };
  const btn = (primary=true) => ({
    padding:"9px 20px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:13,
    background: primary ? `#${tmpl.primary}` : "#f0f0f0", color: primary ? "#fff" : "#333"
  });

  const flatSlides = sections.flatMap(s =>
    s.isDivider ? [{ ...s, type:"divider" }] :
    Array.from({length:s.slides}, (_,i) => ({ ...s, slideIndex:i, type:"content" }))
  );

  const handleLogo = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => { setLogoPreview(ev.target.result); setLogoDataUrl(ev.target.result); };
    r.readAsDataURL(file);
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!file.name.endsWith(".pdf")) { alert("Please upload a PDF file"); return; }
    setPdfLoading(true);
    try {
      const images = await pdfToImages(file);
      setPdfPages(images);
      setPdfName(file.name);
      setSlideBoxes({});
      setEditingPdf(true);
    } catch(err) {
      alert("Failed to load PDF: " + err.message);
    } finally {
      setPdfLoading(false);
      e.target.value = "";
    }
  };

  const handleBoxChange = (slideIndex, box) => {
    setSlideBoxes(prev => ({ ...prev, [slideIndex]: box }));
  };

  const addSection = () => setSections(s=>[...s,{ id:`s_${Date.now()}`, label:"New Section", labelAr:"قسم جديد", isDivider:false, slides:1 }]);
  const removeSection = (id) => setSections(s=>s.filter(x=>x.id!==id));
  const updateSection = (id,k,v) => setSections(s=>s.map(x=>x.id===id?{...x,[k]:v}:x));
  const moveSection = (idx,dir) => setSections(s=>{ const a=[...s],sw=idx+dir; if(sw<0||sw>=a.length) return a; [a[idx],a[sw]]=[a[sw],a[idx]]; return a; });

  const generate = async () => {
    if (!form.clientName||!form.industry||!form.budget||!form.services) {
      setError("Please fill all required fields (*)"); return;
    }
    setLoading(true); setError("");
    try {
      const contentSections = sections.filter(s=>!s.isDivider);
      const sectionIds = contentSections.map(s=>s.id).join(", ");
      const sys = `You are a bilingual proposal writer for SOL for Business Solutions, Saudi Arabia.
Return ONLY a valid JSON object. No markdown, no backticks, no extra text.
Keep bullet points short (max 10 words each). Max 4 bullet points per section.`;
      const usr = `Write a bilingual business proposal (English + Arabic) for:
Client: ${form.clientName} | Industry: ${form.industry} | Budget: ${form.currency} ${form.budget}
Services: ${form.services}
Challenges: ${form.challenges||"typical for this industry"}
Solution: ${form.solution||"best fit solution"}
Team: ${form.teamMembers||"PM, BA, Consultant"}
Timeline: ${form.timeline||"6 months"}
Payment: ${form.paymentTerms||"50% upfront, 50% on delivery"}

Return JSON with keys: ${sectionIds}, companyName.
Each section: title_en, title_ar, points_en (max 4 short strings), points_ar (max 4 short Arabic strings).
companyName: "${form.clientName}". IMPORTANT: Valid JSON only, no special characters.`;
      const result = await callAPI(sys, usr);
      setData(result); setActiveSlide(0); setActiveTab("preview");
    } catch(e) { setError("Generation failed: " + e.message); }
    finally { setLoading(false); }
  };

  // FIXED image generator — fetches through proxy, converts blob to dataURL
  const handleGenerateImage = async () => {
    if (!imgPrompt.trim()) return;
    setImgLoading(true);
    setError("");
    try {
      const seed = Math.floor(Math.random()*99999);
      const res = await fetch(`/.netlify/functions/image-proxy?prompt=${encodeURIComponent(imgPrompt.trim())}&seed=${seed}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Status ${res.status}`);
      }
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) throw new Error("Response is not an image");
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      setGeneratedImages(imgs => [{ url: dataUrl, prompt: imgPrompt }, ...imgs]);
    } catch(e) {
      setError("Image generation failed: " + e.message);
    } finally {
      setImgLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await exportPPTX(data, tmpl, logoDataUrl, sections, selectedImage, pdfPages.length ? pdfPages : null, slideBoxes); }
    catch(e) { setError(e.message); }
    finally { setExporting(false); }
  };

  const SlidePreview = () => {
    const slide = flatSlides[activeSlide]; if (!slide) return null;
    const content = data?.[slide.id] || {};
    const bgImg = pdfPages.length ? pdfPages[Math.min(activeSlide, pdfPages.length-1)] : null;
    const box = slideBoxes[activeSlide];

    return (
      <div style={{ position:"relative", background:`#${tmpl.bg}`, border:`2px solid #${tmpl.primary}20`, borderRadius:10, overflow:"hidden", minHeight:280 }}>
        {bgImg ? (
          <div style={{ position:"relative" }}>
            <img src={bgImg} style={{ width:"100%", display:"block" }}/>
            {box && (
              <div style={{
                position:"absolute",
                left:`${box.x*100}%`, top:`${box.y*100}%`,
                width:`${box.w*100}%`, height:`${box.h*100}%`,
                background:"rgba(255,255,255,0.85)", borderRadius:4, padding:"6px 8px",
                display:"grid", gridTemplateColumns:"1fr 2px 1fr", gap:4
              }}>
                <div>
                  <div style={{ fontSize:9, fontWeight:700, color:`#${tmpl.primary}`, marginBottom:3 }}>{content.title_en || slide.label}</div>
                  {(content.points_en||[]).map((p,i)=><div key={i} style={{ fontSize:8, color:"#333" }}>• {p}</div>)}
                </div>
                <div style={{ background:"#aaa" }}/>
                <div dir="rtl">
                  <div style={{ fontSize:9, fontWeight:700, color:`#${tmpl.primary}`, marginBottom:3 }}>{content.title_ar || slide.labelAr}</div>
                  {(content.points_ar||[]).map((p,i)=><div key={i} style={{ fontSize:8, color:"#333" }}>{p} •</div>)}
                </div>
              </div>
            )}
            {!box && slide.type==="content" && (
              <div style={{ position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)", background:"rgba(0,0,0,0.6)", color:"#fff", fontSize:10, padding:"4px 10px", borderRadius:20, whiteSpace:"nowrap" }}>
                ✏️ Draw text area in Template tab
              </div>
            )}
          </div>
        ) : slide.type==="divider" ? (
          <div style={{ background:`#${tmpl.primary}`, minHeight:280, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, position:"relative", overflow:"hidden" }}>
            {selectedImage && <img src={selectedImage} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.2 }}/>}
            <div style={{ background:`#${tmpl.accent}`, padding:"12px 32px", borderRadius:6, textAlign:"center", position:"relative" }}>
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
      <div style={{ background:`#${tmpl.primary}`, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={{ color:"#fff", fontWeight:800, fontSize:18 }}>{isAr?"مولّد عروض SOL":"SOL Proposal Generator"}</div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          {["english","arabic"].map(l=>(
            <button key={l} onClick={()=>set("lang",l)}
              style={{ padding:"4px 12px", borderRadius:20, border:"none", cursor:"pointer",
                background:form.lang===l?"#fff":"rgba(255,255,255,0.2)",
                color:form.lang===l?`#${tmpl.primary}`:"#fff", fontWeight:700, fontSize:12 }}>
              {l==="english"?"EN":"ع"}
            </button>
          ))}
          {[["form","📝 Form","📝 نموذج"],["sections","📋 Sections","📋 أقسام"],["template","🖼 Template","🖼 القالب"]].map(([tab,en,ar])=>(
            <button key={tab} onClick={()=>setActiveTab(tab)}
              style={{ padding:"5px 14px", borderRadius:20, border:"none", cursor:"pointer",
                background:activeTab===tab?"rgba(255,255,255,0.25)":"transparent",
                color:"#fff", fontWeight:activeTab===tab?800:600, fontSize:12 }}>
              {isAr?ar:en}
            </button>
          ))}
          {data && (
            <button onClick={()=>setActiveTab("preview")}
              style={{ padding:"5px 14px", borderRadius:20, border:"none", cursor:"pointer",
                background:activeTab==="preview"?"rgba(255,255,255,0.25)":"transparent",
                color:"#fff", fontWeight:activeTab==="preview"?800:600, fontSize:12 }}>
              {isAr?"👁 معاينة":"👁 Preview"}
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth:960, margin:"24px auto", padding:"0 16px" }}>

        {/* FORM */}
        {activeTab==="form" && (
          <div style={{ background:"#fff", borderRadius:14, padding:28, boxShadow:"0 2px 16px rgba(0,0,0,.08)" }}>
            <div style={{ display:"flex", marginBottom:20, borderRadius:10, overflow:"hidden", border:`1.5px solid #${tmpl.primary}30` }}>
              {[isAr?"بيانات العميل":"Client Info", isAr?"التصميم والصور":"Design & Images", isAr?"المحتوى":"Content"].map((s,idx)=>(
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
              {/* only show built-in templates if no PDF uploaded */}
              {!pdfPages.length && <>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>🎨 {isAr?"اختر تصميماً":"Choose a Design"}</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
                  {DEFAULT_TEMPLATES.map(t=>(
                    <div key={t.id} onClick={()=>setTmplId(t.id)}
                      style={{ border:`2.5px solid ${tmplId===t.id?`#${t.primary}`:"#e0e0e0"}`, borderRadius:10, padding:12, cursor:"pointer", textAlign:"center",
                        background:tmplId===t.id?`#${t.bg}`:"#fff" }}>
                      <div style={{ fontSize:22, marginBottom:4 }}>{t.icon}</div>
                      <div style={{ fontWeight:700, fontSize:12, color:`#${t.primary}` }}>{isAr?t.nameAr:t.name}</div>
                      <div style={{ display:"flex", gap:3, justifyContent:"center", marginTop:5 }}>
                        {[t.primary,t.secondary,t.accent].map((c,i)=><div key={i} style={{ width:12,height:12,borderRadius:"50%",background:`#${c}` }}/>)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background:"#f8f9fa", borderRadius:10, padding:14, marginBottom:14 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>🖌 {isAr?"تخصيص الألوان":"Customize Colors"}</div>
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
                          <input type="color" value={`#${customColors[tmplId]?.[key]||baseTmpl[key]}`}
                            onChange={e=>setCustomColors(c=>({...c,[tmplId]:{...(c[tmplId]||{}),[key]:e.target.value.replace("#","")}}))}
                            style={{ width:40, height:32, border:"none", borderRadius:6, cursor:"pointer" }}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>}

              {pdfPages.length > 0 && (
                <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, padding:12, marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:"#15803d" }}>✅ PDF Template Active</div>
                    <div style={{ fontSize:11, color:"#166534" }}>{pdfName} — {pdfPages.length} pages</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>setActiveTab("template")} style={{...btn(), fontSize:11}}>✏️ Edit Text Areas</button>
                    <button onClick={()=>{setPdfPages([]);setPdfName("");setSlideBoxes({});}} style={{ padding:"6px 12px", borderRadius:7, border:"none", background:"#fee2e2", color:"#c00", fontSize:11, cursor:"pointer" }}>✕ Remove</button>
                  </div>
                </div>
              )}

              {/* AI Image Generator */}
              <div style={{ background:"#fdf4ff", borderRadius:10, padding:14, marginBottom:14, border:"1px solid #e9d5ff" }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>🖼 {isAr?"إنشاء صور بالذكاء الاصطناعي":"Generate AI Images"}</div>
                <div style={{ fontSize:11, color:"#666", marginBottom:10 }}>
                  {isAr?"أنشئ صوراً واختر منها لإضافتها لشرائح الفواصل":"Generate images and pick one to add to your divider slides"}
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  <input value={imgPrompt} onChange={e=>setImgPrompt(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleGenerateImage()}
                    placeholder={isAr?"مثال: مكتب حديث في الرياض":"e.g. Modern office in Riyadh, Saudi Arabia"}
                    style={{ flex:1, padding:"8px 12px", border:"1.5px solid #ddd", borderRadius:8, fontSize:12, outline:"none" }}/>
                  <button onClick={handleGenerateImage} disabled={imgLoading||!imgPrompt.trim()}
                    style={{...btn(), fontSize:12, opacity:(imgLoading||!imgPrompt.trim())?.7:1}}>
                    {imgLoading?"⏳ Loading...":(isAr?"✨ إنشاء":"✨ Generate")}
                  </button>
                </div>
                {generatedImages.length > 0 && (
                  <>
                    <div style={{ fontSize:12, fontWeight:600, color:"#555", marginBottom:8 }}>
                      {isAr?"اختر صورة:":"Select an image to use:"}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                      {generatedImages.map((img,i)=>(
                        <div key={i} onClick={()=>setSelectedImage(selectedImage===img.url?null:img.url)}
                          style={{ cursor:"pointer", borderRadius:8, overflow:"hidden", position:"relative",
                            border: selectedImage===img.url?`3px solid #${tmpl.primary}`:"3px solid #eee" }}>
                          <img src={img.url} alt={img.prompt} style={{ width:"100%", height:90, objectFit:"cover", display:"block" }}/>
                          {selectedImage===img.url && (
                            <div style={{ position:"absolute", top:4, right:4, background:`#${tmpl.primary}`, borderRadius:"50%",
                              width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff" }}>✓</div>
                          )}
                        </div>
                      ))}
                    </div>
                    {selectedImage && (
                      <div style={{ marginTop:8, fontSize:11, color:`#${tmpl.primary}`, fontWeight:600 }}>
                        ✅ {isAr?"تم اختيار الصورة":"Image selected — will appear on divider slides"}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <button onClick={()=>setStep(1)} style={btn(false)}>{isAr?"→ رجوع":"← Back"}</button>
                <button onClick={()=>setStep(3)} style={btn()}>{isAr?"التالي →":"Next →"}</button>
              </div>
            </>}

            {step===3 && <>
              <Field label={isAr?"الخدمات المقدمة *":"Services Offered *"}>
                <Textarea value={form.services} onChange={v=>set("services",v)} placeholder="e.g. ERP implementation, IT consulting"/>
              </Field>
              <Field label={isAr?"تحديات العميل":"Client Challenges"}>
                <Textarea value={form.challenges} onChange={v=>set("challenges",v)} placeholder="e.g. Outdated systems..."/>
              </Field>
              <Field label={isAr?"الحل المقترح":"Proposed Solution"}>
                <Textarea value={form.solution} onChange={v=>set("solution",v)} placeholder="e.g. SAP implementation..."/>
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label={isAr?"أعضاء الفريق":"Team Members"}><Input value={form.teamMembers} onChange={v=>set("teamMembers",v)} placeholder="PM, BA, Developer"/></Field>
                <Field label={isAr?"الجدول الزمني":"Timeline"}><Input value={form.timeline} onChange={v=>set("timeline",v)} placeholder="6 months"/></Field>
              </div>
              <Field label={isAr?"شروط الدفع":"Payment Terms"}>
                <Input value={form.paymentTerms} onChange={v=>set("paymentTerms",v)} placeholder="50% upfront, 50% delivery"/>
              </Field>
              <Field label={isAr?"ملاحظات إضافية":"Additional Notes"}>
                <Textarea value={form.notes} onChange={v=>set("notes",v)} rows={2} placeholder="Any extra context..."/>
              </Field>
              {error && <div style={{ background:"#fff0f0", border:"1px solid #fcc", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#c00", marginBottom:12 }}>{error}</div>}
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <button onClick={()=>setStep(2)} style={btn(false)}>{isAr?"→ رجوع":"← Back"}</button>
                <button onClick={generate} disabled={loading} style={{...btn(),opacity:loading?.7:1}}>
                  {loading?(isAr?"جاري الإنشاء...":"⏳ Generating..."):(isAr?"✨ إنشاء العرض":"✨ Generate Proposal")}
                </button>
              </div>
            </>}
          </div>
        )}

        {/* TEMPLATE TAB */}
        {activeTab==="template" && (
          <div style={{ background:"#fff", borderRadius:14, padding:28, boxShadow:"0 2px 16px rgba(0,0,0,.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:16 }}>🖼 {isAr?"قالب PDF":"PDF Template"}</div>
              <button onClick={()=>pdfFileRef.current.click()} style={btn()}>
                {pdfLoading?"⏳ Loading PDF...":"📂 Upload PDF Template"}
              </button>
              <input ref={pdfFileRef} type="file" accept=".pdf" style={{ display:"none" }} onChange={handlePdfUpload}/>
            </div>

            {!pdfPages.length && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:"#888", border:"2px dashed #ddd", borderRadius:10 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
                <div style={{ fontWeight:700, marginBottom:6 }}>Upload your SOL PDF template</div>
                <div style={{ fontSize:12 }}>Each page will be used as a slide background. You'll draw text areas on each slide.</div>
              </div>
            )}

            {pdfPages.length > 0 && (
              <>
                <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#92400e", marginBottom:16 }}>
                  💡 <strong>Draw a box</strong> on each slide to mark where AI text should appear. Click and drag to draw.
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16 }}>
                  {flatSlides.map((slide, idx) => {
                    const pageImg = pdfPages[Math.min(idx, pdfPages.length-1)];
                    return (
                      <div key={idx} style={{ border:`2px solid ${slideBoxes[idx]?"#16a34a":"#e0e0e0"}`, borderRadius:10, overflow:"hidden" }}>
                        <div style={{ background: slideBoxes[idx]?"#f0fdf4":"#f8f9fa", padding:"6px 10px", fontSize:11, fontWeight:700, color: slideBoxes[idx]?"#15803d":"#555", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span>Slide {idx+1}: {slide.label.split(" ").slice(0,3).join(" ")}</span>
                          {slideBoxes[idx] && <span style={{ fontSize:10, color:"#16a34a" }}>✓ Area set</span>}
                          {slideBoxes[idx] && <button onClick={()=>setSlideBoxes(p=>{const n={...p};delete n[idx];return n;})} style={{ background:"none", border:"none", color:"#c00", cursor:"pointer", fontSize:12 }}>✕ Clear</button>}
                        </div>
                        {slide.type === "content" ? (
                          <SlideBoxEditor imgSrc={pageImg} box={slideBoxes[idx]} onChange={handleBoxChange} slideIndex={idx}/>
                        ) : (
                          <div style={{ position:"relative" }}>
                            <img src={pageImg} style={{ width:"100%", display:"block" }}/>
                            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.3)" }}>
                              <span style={{ color:"#fff", fontWeight:700, fontSize:12, background:"rgba(0,0,0,0.5)", padding:"4px 10px", borderRadius:20 }}>§ Divider Slide</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop:16, textAlign:"right" }}>
                  <button onClick={()=>setActiveTab("form")} style={btn()}>✅ Done — Go to Form</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* SECTIONS */}
        {activeTab==="sections" && (
          <div style={{ background:"#fff", borderRadius:14, padding:28, boxShadow:"0 2px 16px rgba(0,0,0,.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontWeight:800, fontSize:16 }}>📋 {isAr?"أقسام العرض":"Proposal Sections"}</div>
              <button onClick={addSection} style={btn()}>+ {isAr?"إضافة قسم":"Add Section"}</button>
            </div>
            {sections.map((s,idx)=>(
              <div key={s.id} style={{ border:"1.5px solid #e0e0e0", borderRadius:10, padding:12, marginBottom:8, background:s.isDivider?`#${tmpl.primary}08`:"#fff" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto auto auto auto", gap:8, alignItems:"center" }}>
                  <input value={s.label} onChange={e=>updateSection(s.id,"label",e.target.value)}
                    style={{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:6, fontSize:12 }} placeholder="English label"/>
                  <input value={s.labelAr} onChange={e=>updateSection(s.id,"labelAr",e.target.value)}
                    style={{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:6, fontSize:12, direction:"rtl" }} placeholder="التسمية"/>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:9, color:"#888" }}>{isAr?"شرائح":"Slides"}</div>
                    <input type="number" min="1" max="10" value={s.slides} onChange={e=>updateSection(s.id,"slides",parseInt(e.target.value)||1)}
                      style={{ width:46, padding:"4px", border:"1px solid #ddd", borderRadius:6, fontSize:12, textAlign:"center" }}/>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:9, color:"#888" }}>{isAr?"فاصل":"Divider"}</div>
                    <input type="checkbox" checked={s.isDivider} onChange={e=>updateSection(s.id,"isDivider",e.target.checked)} style={{ width:16, height:16, cursor:"pointer" }}/>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    <button onClick={()=>moveSection(idx,-1)} disabled={idx===0} style={{ padding:"2px 6px", border:"1px solid #ddd", borderRadius:4, fontSize:10, cursor:"pointer", opacity:idx===0?.4:1 }}>↑</button>
                    <button onClick={()=>moveSection(idx,1)} disabled={idx===sections.length-1} style={{ padding:"2px 6px", border:"1px solid #ddd", borderRadius:4, fontSize:10, cursor:"pointer", opacity:idx===sections.length-1?.4:1 }}>↓</button>
                  </div>
                  <button onClick={()=>removeSection(s.id)} style={{ padding:"4px 8px", border:"none", borderRadius:6, background:"#fff0f0", color:"#c00", fontSize:12, cursor:"pointer" }}>✕</button>
                </div>
              </div>
            ))}
            <div style={{ marginTop:14, padding:"10px 14px", background:"#fffbeb", borderRadius:8, fontSize:11, color:"#92400e", border:"1px solid #fde68a" }}>
              💡 {isAr?"الأقسام المميزة كـ'فاصل' ستظهر كشرائح فاصلة":"Sections marked as Divider appear as separator slides in the PPTX"}
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {activeTab==="preview" && data && (
          <div style={{ background:"#fff", borderRadius:14, padding:28, boxShadow:"0 2px 16px rgba(0,0,0,.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:16, color:`#${tmpl.primary}` }}>{isAr?"معاينة العرض":"Proposal Preview"}</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>{setData(null);setActiveTab("form");setStep(1);}} style={btn(false)}>✏️ {isAr?"تعديل":"Edit"}</button>
                <button onClick={handleExport} disabled={exporting} style={{...btn(),opacity:exporting?.7:1}}>
                  {exporting?"⏳":`⬇️ ${isAr?"تحميل PPTX":"Download PPTX"}`}
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
              💡 {isAr?"ملف PPTX يفتح في PowerPoint أو Google Slides":"PPTX opens in PowerPoint. For Google Slides: File → Import Slides"}
            </div>
            {error && <div style={{ marginTop:8, background:"#fff0f0", border:"1px solid #fcc", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#c00" }}>{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}