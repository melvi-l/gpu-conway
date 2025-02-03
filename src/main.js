import './style.css'

const GRID_SIZE = 16;


async function main() {
    const canvas = document.getElementById("webgpu")

    if (!navigator.gpu) {
        alert("no webGPU")
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) {
        alert("no GPU adapter")
    }

    const device = await adapter.requestDevice()
    console.log("using device:", device)

    const ctx = canvas.getContext("webgpu")
    const format = navigator.gpu.getPreferredCanvasFormat()
    console.log("using format:", format)
    ctx.configure({
        device,
        format
    })

    const encoder = device.createCommandEncoder()
    console.log("using encoder:", encoder)


    const vertices = new Float32Array([
        -0.8, -0.8,
        0.8, -0.8,
        0.8, 0.8,
        -0.8, -0.8,
        0.8, 0.8,
        -0.8, 0.8,
    ]);

    const vertexBuffer = device.createBuffer({
        label: "Cell vertices",
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    })

    device.queue.writeBuffer(vertexBuffer, 0, vertices)

    const vertexBufferLayout = {
        arrayStride: 8,
        attributes: [{
            format: "float32x2",
            offset: 0,
            shaderLocation: 0,
        }]
    }

    const cellShaderModule = device.createShaderModule({
        label: "Cell shader",
        code: `
    @group(0) @binding(0) var<uniform> grid: vec2f;

    @vertex
    fn vertexMain(@location(0) pos: vec2f, @builtin(instance_index) instance: u32) -> @builtin(position) vec4f {
        let i = f32(instance);
        let cell = vec2f(floor(i / grid.x), i % grid.y);
        let cellOffset = cell / grid * 2;
        let gridPos = (pos + 1) / grid - 1 + cellOffset;
        return vec4f(gridPos, 0, 1);
    }

    @fragment
    fn fragmentMain() -> @location(0) vec4f {
        return vec4f(0, .3, .5, 1);
    }
    `
    })

    const cellPipeline = device.createRenderPipeline({
        label: "Cell pipeline",
        layout: "auto",
        vertex: {
            module: cellShaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBufferLayout]
        },
        fragment: {
            module: cellShaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format
            }]
        }
    })

    const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE])
    const uniformBuffer = device.createBuffer({
        label: "Grid uniform",
        size: uniformArray.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    device.queue.writeBuffer(uniformBuffer, 0, uniformArray)

    const bindGroup = device.createBindGroup({
        label: "Cell bind group",
        layout: cellPipeline.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer }
        }]
    })

    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: ctx.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: [0, .5, .7, 1],
        }]
    })
    pass.setPipeline(cellPipeline)
    pass.setVertexBuffer(0, vertexBuffer)
    pass.setBindGroup(0, bindGroup)
    pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE)
    pass.end()

    device.queue.submit([encoder.finish()])
}

main()
