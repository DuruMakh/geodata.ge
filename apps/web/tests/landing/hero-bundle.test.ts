import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const heroSource = readFileSync(resolve(process.cwd(), "components/landing/hero-relief.tsx"), "utf8");

describe("landing hero bundle boundary", () => {
  it("imports only the Three.js modules used by the scene", () => {
    expect(heroSource).not.toMatch(/from\s+["']three["']/);
    for (const module of [
      "three/src/core/BufferAttribute.js",
      "three/src/core/BufferGeometry.js",
      "three/src/materials/LineBasicMaterial.js",
      "three/src/materials/Material.js",
      "three/src/materials/ShaderMaterial.js",
      "three/src/cameras/PerspectiveCamera.js",
      "three/src/math/Vector3.js",
      "three/src/objects/LineLoop.js",
      "three/src/objects/Points.js",
      "three/src/renderers/WebGLRenderer.js",
      "three/src/scenes/Scene.js",
    ]) {
      expect(heroSource).toContain(`from "${module}"`);
    }
  });
});
