// JSX type declarations for HSX
// Provides type safety for JSX elements used with the hsx library

declare namespace JSX {
  type Element = unknown;

  interface ElementChildrenAttribute {
    children: unknown;
  }

  // HTML intrinsic elements with common attributes
  interface IntrinsicElements {
    // Document metadata
    html: HtmlHTMLAttributes;
    head: HTMLAttributes;
    title: HTMLAttributes;
    base: BaseHTMLAttributes;
    link: LinkHTMLAttributes;
    meta: MetaHTMLAttributes;
    style: StyleHTMLAttributes;

    // Sections
    body: HTMLAttributes;
    article: HTMLAttributes;
    section: HTMLAttributes;
    nav: HTMLAttributes;
    aside: HTMLAttributes;
    h1: HTMLAttributes;
    h2: HTMLAttributes;
    h3: HTMLAttributes;
    h4: HTMLAttributes;
    h5: HTMLAttributes;
    h6: HTMLAttributes;
    hgroup: HTMLAttributes;
    header: HTMLAttributes;
    footer: HTMLAttributes;
    address: HTMLAttributes;

    // Grouping content
    p: HTMLAttributes;
    hr: HTMLAttributes;
    pre: HTMLAttributes;
    blockquote: BlockquoteHTMLAttributes;
    ol: OlHTMLAttributes;
    ul: HTMLAttributes;
    li: LiHTMLAttributes;
    dl: HTMLAttributes;
    dt: HTMLAttributes;
    dd: HTMLAttributes;
    figure: HTMLAttributes;
    figcaption: HTMLAttributes;
    main: HTMLAttributes;
    div: HTMLAttributes;

    // Text-level semantics
    a: AnchorHTMLAttributes;
    em: HTMLAttributes;
    strong: HTMLAttributes;
    small: HTMLAttributes;
    s: HTMLAttributes;
    cite: HTMLAttributes;
    q: QuoteHTMLAttributes;
    dfn: HTMLAttributes;
    abbr: HTMLAttributes;
    ruby: HTMLAttributes;
    rt: HTMLAttributes;
    rp: HTMLAttributes;
    data: DataHTMLAttributes;
    time: TimeHTMLAttributes;
    code: HTMLAttributes;
    var: HTMLAttributes;
    samp: HTMLAttributes;
    kbd: HTMLAttributes;
    sub: HTMLAttributes;
    sup: HTMLAttributes;
    i: HTMLAttributes;
    b: HTMLAttributes;
    u: HTMLAttributes;
    mark: HTMLAttributes;
    bdi: HTMLAttributes;
    bdo: BdoHTMLAttributes;
    span: HTMLAttributes;
    br: HTMLAttributes;
    wbr: HTMLAttributes;

    // Edits
    ins: InsHTMLAttributes;
    del: DelHTMLAttributes;

    // Embedded content
    picture: HTMLAttributes;
    source: SourceHTMLAttributes;
    img: ImgHTMLAttributes;
    iframe: IframeHTMLAttributes;
    embed: EmbedHTMLAttributes;
    object: ObjectHTMLAttributes;
    param: ParamHTMLAttributes;
    video: VideoHTMLAttributes;
    audio: AudioHTMLAttributes;
    track: TrackHTMLAttributes;
    map: MapHTMLAttributes;
    area: AreaHTMLAttributes;

    // Tabular data
    table: TableHTMLAttributes;
    caption: HTMLAttributes;
    colgroup: ColgroupHTMLAttributes;
    col: ColHTMLAttributes;
    tbody: HTMLAttributes;
    thead: HTMLAttributes;
    tfoot: HTMLAttributes;
    tr: HTMLAttributes;
    td: TdHTMLAttributes;
    th: ThHTMLAttributes;

    // Forms
    form: FormHTMLAttributes;
    label: LabelHTMLAttributes;
    input: InputHTMLAttributes;
    button: ButtonHTMLAttributes;
    select: SelectHTMLAttributes;
    datalist: HTMLAttributes;
    optgroup: OptgroupHTMLAttributes;
    option: OptionHTMLAttributes;
    textarea: TextareaHTMLAttributes;
    output: OutputHTMLAttributes;
    progress: ProgressHTMLAttributes;
    meter: MeterHTMLAttributes;
    fieldset: FieldsetHTMLAttributes;
    legend: HTMLAttributes;

    // Interactive elements
    details: DetailsHTMLAttributes;
    summary: HTMLAttributes;
    dialog: DialogHTMLAttributes;
    menu: MenuHTMLAttributes;

    // Scripting
    script: ScriptHTMLAttributes;
    noscript: HTMLAttributes;
    template: TemplateHTMLAttributes;
    slot: SlotHTMLAttributes;
    canvas: CanvasHTMLAttributes;

    // SVG elements (common subset)
    svg: SVGAttributes;
    g: SVGAttributes;
    path: SVGAttributes;
    circle: SVGAttributes;
    ellipse: SVGAttributes;
    line: SVGAttributes;
    polyline: SVGAttributes;
    polygon: SVGAttributes;
    rect: SVGAttributes;
    text: SVGAttributes;
    tspan: SVGAttributes;
    use: SVGAttributes;
    defs: SVGAttributes;
    clipPath: SVGAttributes;
    mask: SVGAttributes;
    pattern: SVGAttributes;
    image: SVGAttributes;
    symbol: SVGAttributes;
    linearGradient: SVGAttributes;
    radialGradient: SVGAttributes;
    stop: SVGAttributes;
    filter: SVGAttributes;
    feBlend: SVGAttributes;
    feColorMatrix: SVGAttributes;
    feComponentTransfer: SVGAttributes;
    feComposite: SVGAttributes;
    feConvolveMatrix: SVGAttributes;
    feDiffuseLighting: SVGAttributes;
    feDisplacementMap: SVGAttributes;
    feFlood: SVGAttributes;
    feGaussianBlur: SVGAttributes;
    feImage: SVGAttributes;
    feMerge: SVGAttributes;
    feMergeNode: SVGAttributes;
    feMorphology: SVGAttributes;
    feOffset: SVGAttributes;
    feSpecularLighting: SVGAttributes;
    feTile: SVGAttributes;
    feTurbulence: SVGAttributes;
    foreignObject: SVGAttributes;

    // Allow any other element
    [elemName: string]: unknown;
  }

  // Base HTML attributes
  interface HTMLAttributes {
    // Global attributes
    accessKey?: string;
    class?: string;
    className?: string;
    contentEditable?: boolean | "true" | "false" | "inherit";
    contextMenu?: string;
    dir?: "ltr" | "rtl" | "auto";
    draggable?: boolean | "true" | "false";
    hidden?: boolean;
    id?: string;
    lang?: string;
    slot?: string;
    spellCheck?: boolean | "true" | "false";
    style?: string | Record<string, string | number>;
    tabIndex?: number;
    title?: string;
    translate?: "yes" | "no";

    // ARIA attributes
    role?: string;
    "aria-activedescendant"?: string;
    "aria-atomic"?: boolean | "true" | "false";
    "aria-autocomplete"?: "none" | "inline" | "list" | "both";
    "aria-busy"?: boolean | "true" | "false";
    "aria-checked"?: boolean | "true" | "false" | "mixed";
    "aria-colcount"?: number;
    "aria-colindex"?: number;
    "aria-colspan"?: number;
    "aria-controls"?: string;
    "aria-current"?:
      | boolean
      | "true"
      | "false"
      | "page"
      | "step"
      | "location"
      | "date"
      | "time";
    "aria-describedby"?: string;
    "aria-details"?: string;
    "aria-disabled"?: boolean | "true" | "false";
    "aria-dropeffect"?: "none" | "copy" | "execute" | "link" | "move" | "popup";
    "aria-errormessage"?: string;
    "aria-expanded"?: boolean | "true" | "false";
    "aria-flowto"?: string;
    "aria-grabbed"?: boolean | "true" | "false";
    "aria-haspopup"?:
      | boolean
      | "true"
      | "false"
      | "menu"
      | "listbox"
      | "tree"
      | "grid"
      | "dialog";
    "aria-hidden"?: boolean | "true" | "false";
    "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
    "aria-keyshortcuts"?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    "aria-level"?: number;
    "aria-live"?: "off" | "assertive" | "polite";
    "aria-modal"?: boolean | "true" | "false";
    "aria-multiline"?: boolean | "true" | "false";
    "aria-multiselectable"?: boolean | "true" | "false";
    "aria-orientation"?: "horizontal" | "vertical";
    "aria-owns"?: string;
    "aria-placeholder"?: string;
    "aria-posinset"?: number;
    "aria-pressed"?: boolean | "true" | "false" | "mixed";
    "aria-readonly"?: boolean | "true" | "false";
    "aria-relevant"?:
      | "additions"
      | "additions text"
      | "all"
      | "removals"
      | "text";
    "aria-required"?: boolean | "true" | "false";
    "aria-roledescription"?: string;
    "aria-rowcount"?: number;
    "aria-rowindex"?: number;
    "aria-rowspan"?: number;
    "aria-selected"?: boolean | "true" | "false";
    "aria-setsize"?: number;
    "aria-sort"?: "none" | "ascending" | "descending" | "other";
    "aria-valuemax"?: number;
    "aria-valuemin"?: number;
    "aria-valuenow"?: number;
    "aria-valuetext"?: string;

    // HSX HTMX semantic aliases
    get?: string;
    post?: string;
    put?: string;
    patch?: string;
    delete?: string;
    target?: string;
    swap?: string;
    pushUrl?: string | boolean;
    trigger?: string;
    behavior?: "boost";

    // Data attributes
    [key: `data-${string}`]: string | number | boolean | undefined;

    // Allow children
    children?: unknown;

    // Allow any other attribute
    [key: string]: unknown;
  }

  // Specific element attributes
  interface HtmlHTMLAttributes extends HTMLAttributes {
    manifest?: string;
    xmlns?: string;
  }

  interface AnchorHTMLAttributes extends HTMLAttributes {
    download?: string | boolean;
    href?: string;
    hrefLang?: string;
    media?: string;
    ping?: string;
    rel?: string;
    target?: string;
    type?: string;
    referrerPolicy?: string;
  }

  interface AreaHTMLAttributes extends HTMLAttributes {
    alt?: string;
    coords?: string;
    download?: string | boolean;
    href?: string;
    hrefLang?: string;
    media?: string;
    ping?: string;
    rel?: string;
    shape?: string;
    target?: string;
  }

  interface AudioHTMLAttributes extends MediaHTMLAttributes {}

  interface BaseHTMLAttributes extends HTMLAttributes {
    href?: string;
    target?: string;
  }

  interface BlockquoteHTMLAttributes extends HTMLAttributes {
    cite?: string;
  }

  interface ButtonHTMLAttributes extends HTMLAttributes {
    autoFocus?: boolean;
    disabled?: boolean;
    form?: string;
    formAction?: string;
    formEncType?: string;
    formMethod?: string;
    formNoValidate?: boolean;
    formTarget?: string;
    name?: string;
    type?: "submit" | "reset" | "button";
    value?: string | readonly string[] | number;
  }

  interface CanvasHTMLAttributes extends HTMLAttributes {
    height?: number | string;
    width?: number | string;
  }

  interface ColHTMLAttributes extends HTMLAttributes {
    span?: number;
    width?: number | string;
  }

  interface ColgroupHTMLAttributes extends HTMLAttributes {
    span?: number;
  }

  interface DataHTMLAttributes extends HTMLAttributes {
    value?: string | readonly string[] | number;
  }

  interface DetailsHTMLAttributes extends HTMLAttributes {
    open?: boolean;
  }

  interface DelHTMLAttributes extends HTMLAttributes {
    cite?: string;
    dateTime?: string;
  }

  interface DialogHTMLAttributes extends HTMLAttributes {
    open?: boolean;
  }

  interface EmbedHTMLAttributes extends HTMLAttributes {
    height?: number | string;
    src?: string;
    type?: string;
    width?: number | string;
  }

  interface FieldsetHTMLAttributes extends HTMLAttributes {
    disabled?: boolean;
    form?: string;
    name?: string;
  }

  interface FormHTMLAttributes extends HTMLAttributes {
    acceptCharset?: string;
    action?: string;
    autoComplete?: string;
    encType?: string;
    method?: string;
    name?: string;
    noValidate?: boolean;
    target?: string;
  }

  interface IframeHTMLAttributes extends HTMLAttributes {
    allow?: string;
    allowFullScreen?: boolean;
    allowTransparency?: boolean;
    frameBorder?: number | string;
    height?: number | string;
    loading?: "eager" | "lazy";
    marginHeight?: number;
    marginWidth?: number;
    name?: string;
    referrerPolicy?: string;
    sandbox?: string;
    scrolling?: string;
    seamless?: boolean;
    src?: string;
    srcDoc?: string;
    width?: number | string;
  }

  interface ImgHTMLAttributes extends HTMLAttributes {
    alt?: string;
    crossOrigin?: "anonymous" | "use-credentials" | "";
    decoding?: "async" | "auto" | "sync";
    height?: number | string;
    loading?: "eager" | "lazy";
    referrerPolicy?: string;
    sizes?: string;
    src?: string;
    srcSet?: string;
    useMap?: string;
    width?: number | string;
  }

  interface InsHTMLAttributes extends HTMLAttributes {
    cite?: string;
    dateTime?: string;
  }

  interface InputHTMLAttributes extends HTMLAttributes {
    accept?: string;
    alt?: string;
    autoComplete?: string;
    autoFocus?: boolean;
    capture?: boolean | "user" | "environment";
    checked?: boolean;
    crossOrigin?: string;
    disabled?: boolean;
    enterKeyHint?:
      | "enter"
      | "done"
      | "go"
      | "next"
      | "previous"
      | "search"
      | "send";
    form?: string;
    formAction?: string;
    formEncType?: string;
    formMethod?: string;
    formNoValidate?: boolean;
    formTarget?: string;
    height?: number | string;
    list?: string;
    max?: number | string;
    maxLength?: number;
    min?: number | string;
    minLength?: number;
    multiple?: boolean;
    name?: string;
    pattern?: string;
    placeholder?: string;
    readOnly?: boolean;
    required?: boolean;
    size?: number;
    src?: string;
    step?: number | string;
    type?: string;
    value?: string | readonly string[] | number;
    width?: number | string;
  }

  interface LabelHTMLAttributes extends HTMLAttributes {
    form?: string;
    htmlFor?: string;
    for?: string;
  }

  interface LiHTMLAttributes extends HTMLAttributes {
    value?: string | readonly string[] | number;
  }

  interface LinkHTMLAttributes extends HTMLAttributes {
    as?: string;
    crossOrigin?: string;
    href?: string;
    hrefLang?: string;
    integrity?: string;
    media?: string;
    referrerPolicy?: string;
    rel?: string;
    sizes?: string;
    type?: string;
  }

  interface MapHTMLAttributes extends HTMLAttributes {
    name?: string;
  }

  interface MenuHTMLAttributes extends HTMLAttributes {
    type?: string;
  }

  interface MediaHTMLAttributes extends HTMLAttributes {
    autoPlay?: boolean;
    controls?: boolean;
    controlsList?: string;
    crossOrigin?: string;
    loop?: boolean;
    mediaGroup?: string;
    muted?: boolean;
    playsInline?: boolean;
    preload?: string;
    src?: string;
  }

  interface MetaHTMLAttributes extends HTMLAttributes {
    charSet?: string;
    content?: string;
    httpEquiv?: string;
    name?: string;
    property?: string;
  }

  interface MeterHTMLAttributes extends HTMLAttributes {
    form?: string;
    high?: number;
    low?: number;
    max?: number | string;
    min?: number | string;
    optimum?: number;
    value?: string | readonly string[] | number;
  }

  interface ObjectHTMLAttributes extends HTMLAttributes {
    classID?: string;
    data?: string;
    form?: string;
    height?: number | string;
    name?: string;
    type?: string;
    useMap?: string;
    width?: number | string;
    wmode?: string;
  }

  interface OlHTMLAttributes extends HTMLAttributes {
    reversed?: boolean;
    start?: number;
    type?: "1" | "a" | "A" | "i" | "I";
  }

  interface OptgroupHTMLAttributes extends HTMLAttributes {
    disabled?: boolean;
    label?: string;
  }

  interface OptionHTMLAttributes extends HTMLAttributes {
    disabled?: boolean;
    label?: string;
    selected?: boolean;
    value?: string | readonly string[] | number;
  }

  interface OutputHTMLAttributes extends HTMLAttributes {
    form?: string;
    htmlFor?: string;
    for?: string;
    name?: string;
  }

  interface ParamHTMLAttributes extends HTMLAttributes {
    name?: string;
    value?: string | readonly string[] | number;
  }

  interface ProgressHTMLAttributes extends HTMLAttributes {
    max?: number | string;
    value?: string | readonly string[] | number;
  }

  interface QuoteHTMLAttributes extends HTMLAttributes {
    cite?: string;
  }

  interface BdoHTMLAttributes extends HTMLAttributes {
    dir?: "ltr" | "rtl";
  }

  interface SlotHTMLAttributes extends HTMLAttributes {
    name?: string;
  }

  interface ScriptHTMLAttributes extends HTMLAttributes {
    async?: boolean;
    crossOrigin?: string;
    defer?: boolean;
    integrity?: string;
    noModule?: boolean;
    nonce?: string;
    referrerPolicy?: string;
    src?: string;
    type?: string;
  }

  interface SelectHTMLAttributes extends HTMLAttributes {
    autoComplete?: string;
    autoFocus?: boolean;
    disabled?: boolean;
    form?: string;
    multiple?: boolean;
    name?: string;
    required?: boolean;
    size?: number;
    value?: string | readonly string[] | number;
  }

  interface SourceHTMLAttributes extends HTMLAttributes {
    media?: string;
    sizes?: string;
    src?: string;
    srcSet?: string;
    type?: string;
  }

  interface StyleHTMLAttributes extends HTMLAttributes {
    media?: string;
    nonce?: string;
    scoped?: boolean;
    type?: string;
  }

  interface TableHTMLAttributes extends HTMLAttributes {
    cellPadding?: number | string;
    cellSpacing?: number | string;
    summary?: string;
    width?: number | string;
  }

  interface TemplateHTMLAttributes extends HTMLAttributes {
    shadowRootMode?: "open" | "closed";
  }

  interface TextareaHTMLAttributes extends HTMLAttributes {
    autoComplete?: string;
    autoFocus?: boolean;
    cols?: number;
    dirName?: string;
    disabled?: boolean;
    form?: string;
    maxLength?: number;
    minLength?: number;
    name?: string;
    placeholder?: string;
    readOnly?: boolean;
    required?: boolean;
    rows?: number;
    value?: string | readonly string[] | number;
    wrap?: string;
  }

  interface TdHTMLAttributes extends HTMLAttributes {
    align?: "left" | "center" | "right" | "justify" | "char";
    colSpan?: number;
    headers?: string;
    rowSpan?: number;
    scope?: string;
    abbr?: string;
    valign?: "top" | "middle" | "bottom" | "baseline";
  }

  interface ThHTMLAttributes extends HTMLAttributes {
    align?: "left" | "center" | "right" | "justify" | "char";
    colSpan?: number;
    headers?: string;
    rowSpan?: number;
    scope?: string;
    abbr?: string;
  }

  interface TimeHTMLAttributes extends HTMLAttributes {
    dateTime?: string;
  }

  interface TrackHTMLAttributes extends HTMLAttributes {
    default?: boolean;
    kind?: string;
    label?: string;
    src?: string;
    srcLang?: string;
  }

  interface VideoHTMLAttributes extends MediaHTMLAttributes {
    height?: number | string;
    playsInline?: boolean;
    poster?: string;
    width?: number | string;
    disablePictureInPicture?: boolean;
    disableRemotePlayback?: boolean;
  }

  interface SVGAttributes extends HTMLAttributes {
    accentHeight?: number | string;
    accumulate?: "none" | "sum";
    additive?: "replace" | "sum";
    alignmentBaseline?: string;
    allowReorder?: "no" | "yes";
    alphabetic?: number | string;
    amplitude?: number | string;
    arabicForm?: "initial" | "medial" | "terminal" | "isolated";
    ascent?: number | string;
    attributeName?: string;
    attributeType?: string;
    autoReverse?: string;
    azimuth?: number | string;
    baseFrequency?: number | string;
    baselineShift?: number | string;
    baseProfile?: string;
    bbox?: number | string;
    begin?: number | string;
    bias?: number | string;
    by?: number | string;
    calcMode?: string;
    capHeight?: number | string;
    clip?: number | string;
    clipPath?: string;
    clipPathUnits?: number | string;
    clipRule?: number | string;
    colorInterpolation?: number | string;
    colorInterpolationFilters?: "auto" | "sRGB" | "linearRGB" | "inherit";
    colorProfile?: number | string;
    colorRendering?: number | string;
    contentScriptType?: number | string;
    contentStyleType?: number | string;
    cursor?: number | string;
    cx?: number | string;
    cy?: number | string;
    d?: string;
    decelerate?: number | string;
    descent?: number | string;
    diffuseConstant?: number | string;
    direction?: number | string;
    display?: number | string;
    divisor?: number | string;
    dominantBaseline?: number | string;
    dur?: number | string;
    dx?: number | string;
    dy?: number | string;
    edgeMode?: number | string;
    elevation?: number | string;
    enableBackground?: number | string;
    end?: number | string;
    exponent?: number | string;
    externalResourcesRequired?: string;
    fill?: string;
    fillOpacity?: number | string;
    fillRule?: "nonzero" | "evenodd" | "inherit";
    filter?: string;
    filterRes?: number | string;
    filterUnits?: number | string;
    floodColor?: number | string;
    floodOpacity?: number | string;
    focusable?: string;
    fontFamily?: string;
    fontSize?: number | string;
    fontSizeAdjust?: number | string;
    fontStretch?: number | string;
    fontStyle?: number | string;
    fontVariant?: number | string;
    fontWeight?: number | string;
    format?: number | string;
    from?: number | string;
    fx?: number | string;
    fy?: number | string;
    g1?: number | string;
    g2?: number | string;
    glyphName?: number | string;
    glyphOrientationHorizontal?: number | string;
    glyphOrientationVertical?: number | string;
    glyphRef?: number | string;
    gradientTransform?: string;
    gradientUnits?: string;
    hanging?: number | string;
    height?: number | string;
    horizAdvX?: number | string;
    horizOriginX?: number | string;
    ideographic?: number | string;
    imageRendering?: number | string;
    in?: string;
    in2?: number | string;
    intercept?: number | string;
    k?: number | string;
    k1?: number | string;
    k2?: number | string;
    k3?: number | string;
    k4?: number | string;
    kernelMatrix?: number | string;
    kernelUnitLength?: number | string;
    kerning?: number | string;
    keyPoints?: number | string;
    keySplines?: number | string;
    keyTimes?: number | string;
    lengthAdjust?: number | string;
    letterSpacing?: number | string;
    lightingColor?: number | string;
    limitingConeAngle?: number | string;
    local?: number | string;
    markerEnd?: string;
    markerHeight?: number | string;
    markerMid?: string;
    markerStart?: string;
    markerUnits?: number | string;
    markerWidth?: number | string;
    mask?: string;
    maskContentUnits?: number | string;
    maskUnits?: number | string;
    mathematical?: number | string;
    mode?: number | string;
    numOctaves?: number | string;
    offset?: number | string;
    opacity?: number | string;
    operator?: number | string;
    order?: number | string;
    orient?: number | string;
    orientation?: number | string;
    origin?: number | string;
    overflow?: number | string;
    overlinePosition?: number | string;
    overlineThickness?: number | string;
    paintOrder?: number | string;
    panose1?: number | string;
    pathLength?: number | string;
    patternContentUnits?: string;
    patternTransform?: number | string;
    patternUnits?: string;
    pointerEvents?: number | string;
    points?: string;
    pointsAtX?: number | string;
    pointsAtY?: number | string;
    pointsAtZ?: number | string;
    preserveAlpha?: string;
    preserveAspectRatio?: string;
    primitiveUnits?: number | string;
    r?: number | string;
    radius?: number | string;
    refX?: number | string;
    refY?: number | string;
    renderingIntent?: number | string;
    repeatCount?: number | string;
    repeatDur?: number | string;
    requiredExtensions?: number | string;
    requiredFeatures?: number | string;
    restart?: number | string;
    result?: string;
    rotate?: number | string;
    rx?: number | string;
    ry?: number | string;
    scale?: number | string;
    seed?: number | string;
    shapeRendering?: number | string;
    slope?: number | string;
    spacing?: number | string;
    specularConstant?: number | string;
    specularExponent?: number | string;
    speed?: number | string;
    spreadMethod?: string;
    startOffset?: number | string;
    stdDeviation?: number | string;
    stemh?: number | string;
    stemv?: number | string;
    stitchTiles?: number | string;
    stopColor?: string;
    stopOpacity?: number | string;
    strikethroughPosition?: number | string;
    strikethroughThickness?: number | string;
    string?: number | string;
    stroke?: string;
    strokeDasharray?: string | number;
    strokeDashoffset?: string | number;
    strokeLinecap?: "butt" | "round" | "square" | "inherit";
    strokeLinejoin?: "miter" | "round" | "bevel" | "inherit";
    strokeMiterlimit?: number | string;
    strokeOpacity?: number | string;
    strokeWidth?: number | string;
    surfaceScale?: number | string;
    systemLanguage?: number | string;
    tableValues?: number | string;
    targetX?: number | string;
    targetY?: number | string;
    textAnchor?: string;
    textDecoration?: number | string;
    textLength?: number | string;
    textRendering?: number | string;
    to?: number | string;
    transform?: string;
    u1?: number | string;
    u2?: number | string;
    underlinePosition?: number | string;
    underlineThickness?: number | string;
    unicode?: number | string;
    unicodeBidi?: number | string;
    unicodeRange?: number | string;
    unitsPerEm?: number | string;
    vAlphabetic?: number | string;
    values?: string;
    vectorEffect?: number | string;
    version?: string;
    vertAdvY?: number | string;
    vertOriginX?: number | string;
    vertOriginY?: number | string;
    vHanging?: number | string;
    vIdeographic?: number | string;
    viewBox?: string;
    viewTarget?: number | string;
    visibility?: number | string;
    vMathematical?: number | string;
    width?: number | string;
    widths?: number | string;
    wordSpacing?: number | string;
    writingMode?: number | string;
    x?: number | string;
    x1?: number | string;
    x2?: number | string;
    xChannelSelector?: string;
    xHeight?: number | string;
    xlinkActuate?: string;
    xlinkArcrole?: string;
    xlinkHref?: string;
    xlinkRole?: string;
    xlinkShow?: string;
    xlinkTitle?: string;
    xlinkType?: string;
    xmlBase?: string;
    xmlLang?: string;
    xmlns?: string;
    xmlnsXlink?: string;
    xmlSpace?: string;
    y?: number | string;
    y1?: number | string;
    y2?: number | string;
    yChannelSelector?: string;
    z?: number | string;
    zoomAndPan?: string;
  }
}
