---
name: ui-material-craft
description: Craft visual para UI de produto, dashboards dark/light e materiais ópticos modernos (Apple Liquid Glass iOS 26 / macOS Tahoe / visionOS, vidro lapidado, especulares, refração CSS+SVG e geometria concêntrica). Use sempre em acabamento visual de componentes, mesmo em projetos existentes.
---

> **Precedência:** as preferências do `AGENTS.md` do projeto e os tokens locais prevalecem sobre esta skill. Esta skill define *como executar materiais e acabamentos com qualidade Apple/Linear* dentro de qualquer projeto existente, sem inventar novo tema.

# UI Material Craft — Apple Liquid Glass & Acabamento Óptico

## 1. Por que "Liquid Glass" amador falha em Dark Mode
- **`backdrop-filter: blur(18px)` sobre fundo chapado `#121212` não refrata nada:** sem variação de cor ou luz por trás, o filtro gera uma caixa preta com borda branca dura (efeito wireframe) ou um retângulo cinza leitoso (plástico fosco).
- **Aspecto metálico/industrial:** pontos brilhantes nos cantos, rebites ou bordas sólidas grossas destroem a sensação de vidro líquido e remetem a metal escovado.
- **Buracos pretos opacos:** recortes `#000` com linha branca dura na base parecem caixas de 2005, nunca berços de vidro lapidado.

## 2. Os 5 Pilares Ópticos do Apple Liquid Glass (iOS 26 / macOS Tahoe / visionOS)

### Pilar 1 — Substrato vivo sob o vidro
Vidro só existe opticamente quando curva luz real. Em cards, linhas ou toolbars escuras, estenda sutilmente a luz/cor ambiente do elemento pai ou adicione um halo radial suave atrás do componente vítreo para que `backdrop-filter` e transparência tenham contraste para refratar.

```css
.glass-stage {
  position: relative;
  background:
    radial-gradient(120% 90% at 15% 0%, rgba(120, 175, 255, 0.14), transparent 55%),
    radial-gradient(100% 80% at 85% 100%, rgba(180, 130, 255, 0.10), transparent 60%),
    var(--surface-base, #111317);
}
```

### Pilar 2 — Geometria concêntrica e orgânica
Aplique raios contínuos e matematicamente concêntricos: `R_outer = R_inner + padding` (ex.: container `14px`, padding `4px`, item interno `10px`; ou cápsula/squircle contínuo). Nunca encaixe caixas quadradas rígidas dentro de molduras arredondadas.

### Pilar 3 — Corpo vítreo cristalino (blur leve + saturação alta)
Prefira blur curto com saturação e brilho elevados a blur pesado leitoso. O preenchimento deve ter leve degradê vertical luminoso no topo e transparência quase limpa no centro — nunca cinza opaco.

```css
.liquid-glass {
  border-radius: 14px;
  padding: 4px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.09) 0%,
    rgba(255, 255, 255, 0.04) 45%,
    rgba(255, 255, 255, 0.06) 100%
  );
  backdrop-filter: blur(10px) saturate(180%) brightness(1.1);
  -webkit-backdrop-filter: blur(10px) saturate(180%) brightness(1.1);
}
```

### Pilar 4 — Especular de lente curva (lábio luminoso macio, NUNCA wireframe)
Substitua bordas brancas duras de `1px` ou `mask-composite` estourados por camadas finas e graduadas de `inset box-shadow` + borda hair-thin translúcida + sombra ambiente difusa:

```css
.liquid-glass {
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    inset 0 1px 0.5px rgba(255, 255, 255, 0.38),   /* brilho superior especular fino */
    inset 1px 1px 2px rgba(255, 255, 255, 0.14),   /* reflexo lateral/canto suave */
    inset 0 -1px 1px rgba(255, 255, 255, 0.08),    /* contra-luz inferior sutil */
    inset 0 0 16px rgba(255, 255, 255, 0.04),      /* brilho interno difuso */
    0 8px 24px -8px rgba(0, 0, 0, 0.45);           /* sombra ambiente difusa */
}
```

### Pilar 5 — Refração SVG real (Chromium / Electron / Obsidian)
Quando o DOM permitir (`<svg>` inline ou `data:image/svg+xml`), combine `backdrop-filter: url(#glass-lens)` usando `<feDisplacementMap>` ou `<feTurbulence>` suave com uma camada de frost `blur(4px) saturate(180%)`.

**Regra de Backdrop Root:** nunca aninhe dois elementos com `backdrop-filter` esperando que o filho refrate o efeito do pai. Coloque a distorção SVG e o frost como **camadas irmãs** (`::before` / `::after` ou nós irmãos absolutos) ou dentro de um filtro SVG único combinado, sempre com fallback gracioso para CSS puro:

```html
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <filter id="glass-lens" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" result="noise"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>
```

```css
.liquid-glass-refract {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.liquid-glass-refract::before,
.liquid-glass-refract::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
}
.liquid-glass-refract::before {
  backdrop-filter: blur(8px) saturate(180%) brightness(1.1);
}
@supports (backdrop-filter: url(#glass-lens)) {
  .liquid-glass-refract::after {
    backdrop-filter: url(#glass-lens) blur(4px) saturate(180%);
  }
}
```

## 3. Berços e Moldes Translúcidos Dentro de Vidro
Slots, pills inativas ou poços internos sobre vidro devem ser concêntricos (`R_inner = R_outer - padding`), de baixa opacidade e sem preto chapado ou borda branca grossa:

```css
.glass-well {
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.32),
    inset 0 -1px 0.5px rgba(255, 255, 255, 0.08);
}
```

## 4. Checklist Rápido Antes de Entregar
- [ ] Zero névoa cinza leitosa (opacidade do fill controlada, `saturate` ≥ 160%).
- [ ] Zero wireframe branco duro (borda ≤ `rgba(255,255,255,0.14)`, especular via `inset box-shadow`).
- [ ] Zero aspecto metálico (sem pontos/rebites nos cantos nem gradientes metálicos pesados).
- [ ] Substrato vivo visível atrás da transparência (luz/cor interagindo sob o vidro).
- [ ] Geometria concêntrica (`R_outer = R_inner + padding`) consistente em todos os estados.
