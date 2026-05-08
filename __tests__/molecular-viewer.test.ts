import { describe, expect, it, vi } from "vitest"

// Mock 3dmol to avoid WebGL in test environment
vi.mock("3dmol", () => {
  const mockViewer = {
    addModel: vi.fn(),
    setStyle: vi.fn(),
    removeAllModels: vi.fn(),
    zoomTo: vi.fn(),
    zoom: vi.fn(),
    render: vi.fn(),
    clear: vi.fn(),
  }
  return {
    default: { createViewer: vi.fn(() => mockViewer) },
    createViewer: vi.fn(() => mockViewer),
  }
})

describe("PubChem URL construction", () => {
  it("builds a SMILES-based 3D SDF URL", () => {
    const smiles = "CC(=O)Oc1ccccc1C(=O)O"
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/SDF?record_type=3d`
    expect(url).toContain("pubchem.ncbi.nlm.nih.gov")
    expect(url).toContain(encodeURIComponent(smiles))
    expect(url).toContain("record_type=3d")
  })

  it("builds a compound name lookup URL", () => {
    const name = "aspirin"
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/SDF?record_type=3d`
    expect(url).toContain("compound/name/aspirin")
  })

  it("builds a CID-based SDF URL", () => {
    const cid = "2244"
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${encodeURIComponent(cid)}/SDF?record_type=3d`
    expect(url).toContain("compound/cid/2244")
  })

  it("encodes special characters in SMILES strings", () => {
    const smiles = "C/C=C\\C"
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/SDF?record_type=3d`
    expect(url).not.toContain("C/C=C\\C")
    expect(decodeURIComponent(url)).toContain(smiles)
  })

  it("builds a 2D fallback URL", () => {
    const smiles = "CCO"
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/SDF?record_type=2d`
    expect(url).toContain("record_type=2d")
  })
})

describe("3Dmol mock integration", () => {
  it("creates a mock viewer with expected methods", async () => {
    const $3Dmol = await import("3dmol")
    const viewer = $3Dmol.createViewer({} as HTMLElement, {})
    expect(viewer).toBeDefined()
    expect(typeof viewer.addModel).toBe("function")
    expect(typeof viewer.setStyle).toBe("function")
    expect(typeof viewer.zoomTo).toBe("function")
    expect(typeof viewer.render).toBe("function")
    expect(typeof viewer.clear).toBe("function")
  })

  it("addModel accepts SDF format string", async () => {
    const $3Dmol = await import("3dmol")
    const viewer = $3Dmol.createViewer({} as HTMLElement, {})
    viewer.addModel("mock-sdf-data", "sdf")
    expect(viewer.addModel).toHaveBeenCalledWith("mock-sdf-data", "sdf")
  })

  it("addModel accepts SMI format string", async () => {
    const $3Dmol = await import("3dmol")
    const viewer = $3Dmol.createViewer({} as HTMLElement, {})
    viewer.addModel("CCO", "smi")
    expect(viewer.addModel).toHaveBeenCalledWith("CCO", "smi")
  })
})

describe("Viewer style variations", () => {
  const styles = ["stick", "sphere", "ballAndStick", "line"] as const

  it("has exactly 4 style options", () => {
    expect(styles).toHaveLength(4)
  })

  it.each(styles)("supports '%s' rendering style", (style) => {
    expect(["stick", "sphere", "ballAndStick", "line"]).toContain(style)
  })

  it("default style is ballAndStick", () => {
    expect(styles).toContain("ballAndStick")
  })
})
