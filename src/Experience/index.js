import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import vertexSky from './shaders/sky/sky-vertex-shader.glsl'
import fragmentSky from './shaders/sky/sky-fragment-shader.glsl'

import vertexGround from './shaders/ground/ground-vertex-shader.glsl'
import fragmentGround from './shaders/ground/ground-fragment-shader.glsl'

import vertexGrass from './shaders/grass/grass-vertex-shader.glsl'
import fragmentGrass from './shaders/grass/grass-fragment-shader.glsl'

const NUM_GRASS = 32 * 1024
const GRASS_SEGMENTS = 6
const GRASS_VERTICES = (GRASS_SEGMENTS + 1) * 2
const GRASS_PATCH_SIZE = 25
const GRASS_WIDTH = 0.25
const GRASS_HEIGHT = 2

class Experience {
  constructor(options) {
    this.materials = []
    this.grassGeometry = null

    this.scene = new THREE.Scene()
    this.clock = new THREE.Clock()
    this.textureLoader = new THREE.TextureLoader()
    this.container = options.domElement

    // Arrow function so we don't need manual binding
    this.resize = () => {
      // Update sizes
      this.sizes.width = window.innerWidth
      this.sizes.height = window.innerHeight

      // Update camera
      this.camera.aspect = this.sizes.width / this.sizes.height
      this.camera.updateProjectionMatrix()

      // Update renderer
      this.renderer.setSize(this.sizes.width, this.sizes.height)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

      // Update resolution uniform in the shader material
      for (const material of this.materials) {
        if (material.uniforms.resolution) {
          material.uniforms.resolution.value.set(
            this.sizes.width * window.devicePixelRatio,
            this.sizes.height * window.devicePixelRatio,
          )
        }
      }
    }

    // Arrow function for continuous rendering
    this.update = () => {
      const elapsedTime = this.clock.getElapsedTime()

      for (const material of this.materials) {
        if (material.uniforms.time) {
          material.uniforms.time.value = elapsedTime
        }
      }

      // Update controls
      this.controls.update()

      // Render the scene
      this.renderer.render(this.scene, this.camera)

      // Request next frame
      window.requestAnimationFrame(this.update)
    }

    // Initialize the experience
    this.init()
  }

  init() {
    this.setSizes()
    this.setRenderer()
    this.setCamera()
    this.setLight()

    this.setSky()
    this.setGround()
    this.setGrass()

    // Listen for window resize
    window.addEventListener('resize', this.resize)
    this.resize()

    // Start rendering
    this.update()

    console.log('🤖 Experience initialized')
  }

  setSizes() {
    this.sizes = {
      width: this.container.offsetWidth,
      height: this.container.offsetHeight || window.innerHeight,
    }
  }

  setRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    })
    this.renderer.setSize(this.sizes.width, this.sizes.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.container.appendChild(this.renderer.domElement)
  }

  setCamera() {
    this.camera = new THREE.PerspectiveCamera(75, this.sizes.width / this.sizes.height, 0.1, 10000)
    this.camera.position.set(10, 5, 5)

    this.scene.add(this.camera)

    // Orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
  }

  setLight() {
    const light = new THREE.DirectionalLight(0xffffff, 1.0)
    light.position.set(1, 1, 1)
    light.lookAt(0, 0, 0)
    this.scene.add(light)
  }

  setCube() {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshNormalMaterial()
    const cube = new THREE.Mesh(geometry, material)
    this.scene.add(cube)
  }

  /** WORLD */

  // Make sky
  async setSky() {
    const skyGeo = new THREE.SphereGeometry(5000, 32, 15)
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: vertexSky,
      fragmentShader: fragmentSky,
      side: THREE.BackSide,
    })
    this.sky = new THREE.Mesh(skyGeo, skyMat)
    this.sky.castShadow = false
    this.sky.receiveShadow = false
    this.scene.add(this.sky)
    this.materials.push(skyMat)

    console.log('🔨', 'Sky built!')
  }

  // Make ground
  async setGround() {
    const diffuseTexture = await this.textureLoader.loadAsync('./textures/grid.png')
    diffuseTexture.wrapS = THREE.RepeatWrapping
    diffuseTexture.wrapT = THREE.RepeatWrapping

    const groundMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
        diffuseTexture: { value: diffuseTexture },
      },
      vertexShader: vertexGround,
      fragmentShader: fragmentGround,
    })

    const geometry = new THREE.PlaneGeometry(1, 1, 512, 512)
    const plane = new THREE.Mesh(geometry, groundMat)
    plane.rotateX(-Math.PI / 2)
    plane.scale.setScalar(1000)
    this.scene.add(plane)
    this.materials.push(groundMat)

    console.log('🔨', 'Ground built!')
  }

  async setGrass() {
    const tileDataTexture = await this.textureLoader.loadAsync('./textures/ijc_logo_texture_3.JPG')

    const uniforms = {
      grassParams: {
        value: new THREE.Vector4(GRASS_SEGMENTS, GRASS_PATCH_SIZE, GRASS_WIDTH, GRASS_HEIGHT),
      },
      tileDataTexture: {
        value: tileDataTexture,
      },
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) },
    }

    const grassMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vertexGrass,
      fragmentShader: fragmentGrass,
      side: THREE.FrontSide,
    })

    this.grassGeometry = this.createGeometry(GRASS_SEGMENTS)
    this.grassMesh = new THREE.Mesh(this.grassGeometry, grassMaterial)
    this.grassMesh.position.set(0, 0, 0)
    this.scene.add(this.grassMesh)
    this.materials.push(grassMaterial)

    console.log('🔨', 'Grass built!')
  }

  //
  createGeometry(segments) {
    const VERTICES = (segments + 1) * 2
    const indices = []

    for (let i = 0; i < segments; ++i) {
      const vi = i * 2
      indices[i * 12 + 0] = vi + 0
      indices[i * 12 + 1] = vi + 1
      indices[i * 12 + 2] = vi + 2

      indices[i * 12 + 3] = vi + 2
      indices[i * 12 + 4] = vi + 1
      indices[i * 12 + 5] = vi + 3

      const fi = VERTICES + vi
      indices[i * 12 + 6] = fi + 2
      indices[i * 12 + 7] = fi + 1
      indices[i * 12 + 8] = fi + 0

      indices[i * 12 + 9] = fi + 3
      indices[i * 12 + 10] = fi + 1
      indices[i * 12 + 11] = fi + 2
    }

    const geo = new THREE.InstancedBufferGeometry()
    geo.instanceCount = NUM_GRASS
    geo.setIndex(indices)
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1 + GRASS_PATCH_SIZE * 2)

    return geo
  }
}

export default Experience
