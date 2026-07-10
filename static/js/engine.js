/**
 * METAVAL ENGINE — Pure JSON Formula Runner
 * Formulas live in Supabase (public.formulas.formula_json), fetched
 * directly via the Supabase JS SDK (supabaseClient, from supabaseClient.js).
 * No separate JS plugin system needed.
 */
(function () {
  "use strict";

  let panelSeq  = 0;
  const panelState = {};   // { plugin, unitSystem, fieldUnits }

  window.MetaEngine = { addPanel, removePanel, clearAll, setUnitSystem, openUnitEditor, closeUnitEditor, applyUnitEdits, recalc };

  /* ── addPanel ── called by toolbar "+ Open" button */
  function addPanel() {
    const sel = document.getElementById("formulaDropdown");
    const val = sel ? sel.value : "";
    if (!val) { alert("Please select a formula first."); return; }

    // val is the formula's slug (Supabase primary lookup key)
    const slug = val;

    supabaseClient
      .from("formulas")
      .select("formula_json")
      .eq("slug", slug)
      .single()
      .then(({ data, error }) => {
        if (error) { alert("Could not load formula: " + error.message); return; }

        const formula    = data.formula_json;
        const id         = ++panelSeq;
        const unitSystem = "SI";
        const fieldUnits = buildDefaultFieldUnits(formula, unitSystem);
        panelState[id]   = { formula, unitSystem, fieldUnits };

        const grid  = document.getElementById("panelsGrid");
        const empty = document.getElementById("emptyState");
        grid.insertAdjacentHTML("beforeend", buildPanelHTML(id, formula, unitSystem, fieldUnits));
        empty.style.display = "none";
        updateGridCols();
        recalc(id);
      });

    if (sel) sel.value = "";
  }

  function removePanel(id) {
    const el = document.getElementById("panel-" + id);
    if (el) el.remove();
    delete panelState[id];
    updateGridCols();
    if (!document.querySelector(".calc-panel"))
      document.getElementById("emptyState").style.display = "flex";
  }

  function clearAll() {
    document.getElementById("panelsGrid").innerHTML = "";
    Object.keys(panelState).forEach(k => delete panelState[k]);
    document.getElementById("emptyState").style.display = "flex";
  }

  function updateGridCols() {
    const n = document.querySelectorAll(".calc-panel").length;
    document.getElementById("panelsGrid").style.gridTemplateColumns = n >= 2 ? "repeat(2,1fr)" : "1fr";
  }

  /* ── Unit helpers ── */
  function evalUnit(unitObj) {
    // toBase / fromBase stored as strings like "v => v * 1000"
    // Convert to real functions
    if (typeof unitObj.toBase === "string")   unitObj.toBase   = new Function("v", `return (${unitObj.toBase})(v)`);
    if (typeof unitObj.fromBase === "string") unitObj.fromBase = new Function("v", `return (${unitObj.fromBase})(v)`);
    return unitObj;
  }

  function buildDefaultFieldUnits(formula, sysName) {
    const presets = (formula.unitSystems || {})[sysName] || {};
    const result  = {};
    (formula.inputs || []).forEach(inp => {
      const preferred = presets[inp.id];
      const unit = inp.units.find(u => u.value === preferred) || inp.units[0];
      result[inp.id] = evalUnit({...unit});
    });
    return result;
  }

  /* ── Panel HTML ── */
  function buildPanelHTML(id, f, unitSystem, fieldUnits) {
    const defsHtml = (f.definitions || []).map(d =>
      `<span><strong>${d.symbol}</strong> = ${d.label}</span>`
    ).join("");

    const inputsHtml = (f.inputs || []).map(inp =>
      buildInputRow(id, inp, fieldUnits[inp.id])
    ).join("");

    const sysTabs = ["SI","CGS","Imperial"].map(s =>
      `<button class="sys-tab${s===unitSystem?" active":""}" data-sys="${s}"
         onclick="MetaEngine.setUnitSystem(${id},'${s}')">${s}</button>`
    ).join("");

    return `
<div class="calc-panel" id="panel-${id}">
  <div class="panel-header">
    <div class="panel-title">
      <span class="panel-icon">${f.icon||"🔢"}</span>
      ${f.name}
      <span class="panel-tag">${f.tag||""}</span>
    </div>
    <div class="panel-header-actions">
      <button class="icon-btn" onclick="MetaEngine.openUnitEditor(${id})">⚙ Units</button>
      <button class="panel-close" onclick="MetaEngine.removePanel(${id})">✕</button>
    </div>
  </div>

  <div class="sys-switcher">
    <span class="sys-label">Unit System:</span>${sysTabs}
  </div>

  <div class="panel-formula-box">
    <div class="pf-label">Formula</div>
    <div class="pf-eq">${f.formula||""}</div>
    <div class="pf-defs">${defsHtml}</div>
  </div>

  <div class="panel-inputs">${inputsHtml}</div>
  <div class="derived-grid" id="derived-${id}" style="display:none"></div>
  <div class="panel-results" id="results-${id}"></div>
</div>

<!-- Unit Editor Modal -->
<div class="unit-modal-overlay" id="modal-overlay-${id}" style="display:none"
     onclick="MetaEngine.closeUnitEditor(${id})">
  <div class="unit-modal" onclick="event.stopPropagation()">
    <div class="um-header">
      <span>⚙ Edit Units — ${f.name}</span>
      <button class="panel-close" onclick="MetaEngine.closeUnitEditor(${id})">✕</button>
    </div>
    <div class="um-body" id="um-body-${id}">
      ${buildUnitEditorBody(id, f, fieldUnits)}
    </div>
    <div class="um-footer">
      <button class="btn-secondary" onclick="MetaEngine.closeUnitEditor(${id})">Cancel</button>
      <button class="btn-primary"   onclick="MetaEngine.applyUnitEdits(${id})">Apply Changes</button>
    </div>
  </div>
</div>`;
  }

  function buildInputRow(panelId, inp, activeUnit) {
    const opts = inp.units.map(u =>
      `<option value="${u.value}" ${u.value===activeUnit.value?"selected":""}>${u.label}</option>`
    ).join("");

    const unitSel = inp.units.length > 1
      ? `<select id="pu-${panelId}-${inp.id}" class="unit-sel ${inp.dropdownOnly?"unit-sel-wide":""}"
           onchange="MetaEngine.recalc(${panelId})" data-field="${inp.id}">${opts}</select>`
      : `<select disabled class="unit-sel"><option>${inp.units[0].label}</option></select>`;

    if (inp.dropdownOnly) {
      return `<div class="pi-row"><label>${inp.label}</label><div class="pi-ctrl">${unitSel}</div></div>`;
    }
    return `
<div class="pi-row">
  <label>${inp.label}</label>
  <div class="pi-ctrl">
    <input id="pv-${panelId}-${inp.id}" type="number" step="any" value="${inp.default}"
      oninput="MetaEngine.recalc(${panelId})" onchange="MetaEngine.recalc(${panelId})">
    ${unitSel}
  </div>
</div>`;
  }

  function buildUnitEditorBody(panelId, formula, fieldUnits) {
    return (formula.inputs || []).map(inp => {
      const opts = inp.units.map(u =>
        `<option value="${u.value}" ${u.value===fieldUnits[inp.id].value?"selected":""}>${u.label}</option>`
      ).join("");
      return `
<div class="um-row">
  <label class="um-label">${inp.label}</label>
  <select class="um-sel" id="ume-${panelId}-${inp.id}">${opts}</select>
  <span class="um-hint">Available: ${inp.units.map(u=>u.label).join(", ")}</span>
</div>`;
    }).join("");
  }

  /* ── Unit system switch ── */
  function setUnitSystem(panelId, sysName) {
    const state = panelState[panelId];
    if (!state) return;
    state.unitSystem  = sysName;
    state.fieldUnits  = buildDefaultFieldUnits(state.formula, sysName);

    state.formula.inputs.forEach(inp => {
      const s = document.getElementById(`pu-${panelId}-${inp.id}`);
      if (s) s.value = state.fieldUnits[inp.id].value;
    });
    document.querySelectorAll(`#panel-${panelId} .sys-tab`).forEach(b =>
      b.classList.toggle("active", b.dataset.sys === sysName)
    );
    recalc(panelId);
  }

  /* ── Unit editor modal ── */
  function openUnitEditor(panelId) {
    const state = panelState[panelId];
    if (!state) return;
    document.getElementById(`um-body-${panelId}`).innerHTML =
      buildUnitEditorBody(panelId, state.formula, state.fieldUnits);
    document.getElementById(`modal-overlay-${panelId}`).style.display = "flex";
  }
  function closeUnitEditor(panelId) {
    document.getElementById(`modal-overlay-${panelId}`).style.display = "none";
  }
  function applyUnitEdits(panelId) {
    const state = panelState[panelId];
    if (!state) return;
    state.formula.inputs.forEach(inp => {
      const sel = document.getElementById(`ume-${panelId}-${inp.id}`);
      if (!sel) return;
      const u = inp.units.find(u => u.value === sel.value);
      if (u) {
        state.fieldUnits[inp.id] = evalUnit({...u});
        const ps = document.getElementById(`pu-${panelId}-${inp.id}`);
        if (ps) ps.value = u.value;
      }
    });
    closeUnitEditor(panelId);
    recalc(panelId);
  }

  /* ── Recalculate ── */
  function recalc(panelId) {
    const state = panelState[panelId];
    if (!state) return;
    const { formula, fieldUnits } = state;

    const values = {};
    formula.inputs.forEach(inp => {
      const numEl = document.getElementById(`pv-${panelId}-${inp.id}`);
      const selEl = document.getElementById(`pu-${panelId}-${inp.id}`);

      if (selEl) {
        const chosen = inp.units.find(u => u.value === selEl.value);
        if (chosen) fieldUnits[inp.id] = evalUnit({...chosen});
      }
      values[inp.id]            = parseFloat(numEl ? numEl.value : "0") || 0;
      values[inp.id + "_unit"]  = fieldUnits[inp.id];
    });

    let output = { results: [], derived: [] };
    try {
      const steps  = (formula.calculate || {}).steps || [];
      const fn     = new Function("values", "Math", steps.join("\n"));
      output       = fn(values, Math) || output;
    } catch(e) {
      console.error("calculate error:", e);
    }

    renderResults(panelId, output);
  }

  /* ── Render results ── */
  function renderResults(panelId, output) {
    const derivedEl = document.getElementById(`derived-${panelId}`);
    if (output.derived && output.derived.length) {
      derivedEl.style.display = "grid";
      derivedEl.innerHTML = output.derived.map(d => `
<div class="dg-item">
  <span class="dg-label">${d.label}</span>
  <span class="dg-val">${d.value}</span>
  <span class="dg-unit">${d.unit}</span>
</div>`).join("");
    } else {
      derivedEl.style.display = "none";
      derivedEl.innerHTML = "";
    }

    const resEl = document.getElementById(`results-${panelId}`);
    if (!output.results || !output.results.length) {
      resEl.innerHTML = `<div class="panel-result-empty">Enter valid values to see result</div>`;
      return;
    }
    const many = output.results.length > 1;
    resEl.innerHTML = `
<div class="panel-result ${many?"two-results":""}">
  ${output.results.map(r => `
  <div class="pr-item">
    <div class="pr-label">${r.label}</div>
    <div class="pr-value ${r.highlight?"highlight":""}">${r.value}</div>
    <div class="pr-unit">${r.unit}</div>
  </div>`).join("")}
</div>`;
  }

})();
