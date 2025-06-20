document.addEventListener('DOMContentLoaded', () => {

    const { Engine, Render, Runner, World, Bodies, Body, Events, Vector } = Matter;

    const gameContainer = document.getElementById('game-container');
    // Ajusta o tamanho da mesa para caber na tela, mantendo a proporção 2:1
    const aspect_ratio = 2;
    const width = Math.min(window.innerWidth - 40, 900);
    const height = width / aspect_ratio;

    const ballSize = width / 80;
    const pocketSize = ballSize * 1.8;

    const engine = Engine.create();
    const world = engine.world;
    world.gravity.y = 0;

    const render = Render.create({
        element: gameContainer,
        engine: engine,
        options: {
            width: width,
            height: height,
            wireframes: false,
            background: '#0a5c27'
        }
    });

    // Bordas e Caçapas (código semelhante)
    const wallOptions = { isStatic: true, restitution: 0.8, friction: 0.1, render: { fillStyle: '#4a2a1a' } };
    const wallThickness = 20;
    World.add(world, [
        Bodies.rectangle(width/2, -wallThickness/2, width, wallThickness, wallOptions),
        Bodies.rectangle(width/2, height+wallThickness/2, width, wallThickness, wallOptions),
        Bodies.rectangle(-wallThickness/2, height/2, wallThickness, height, wallOptions),
        Bodies.rectangle(width+wallThickness/2, height/2, wallThickness, height, wallOptions)
    ]);
    const pocketPositions = [ {x:pocketSize*0.8,y:pocketSize*0.8}, {x:width/2,y:pocketSize*0.5}, {x:width-pocketSize*0.8,y:pocketSize*0.8}, {x:pocketSize*0.8,y:height-pocketSize*0.8}, {x:width/2,y:height-pocketSize*0.5}, {x:width-pocketSize*0.8,y:height-pocketSize*0.8} ];
    pocketPositions.forEach(p => World.add(world, Bodies.circle(p.x, p.y, pocketSize, { isStatic: true, isSensor: true, label: 'pocket', render: { fillStyle: 'black' } })));

    // Bolas (código semelhante)
    const ballOptions = { restitution: 0.9, friction: 0.05, frictionAir: 0.01 };
    const cueBall = Bodies.circle(width/4, height/2, ballSize, { ...ballOptions, label: 'cueBall', render: { fillStyle: 'white' } });
    let balls = [cueBall];
    const startX = width * 0.7;
    const startY = height / 2;
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j <= i; j++) {
            balls.push(Bodies.circle(startX + i * ballSize * 1.8, startY - i * ballSize + j * ballSize * 2, ballSize, { ...ballOptions, label: 'ball', render: { fillStyle: i % 2 === 0 ? '#ff4136' : '#ffd700' } }));
        }
    }
    World.add(world, balls);

    // --- LÓGICA DE CONTROLE (MOUSE E TOQUE) ---
    let isShooting = false;
    let startDragPos = null;

    function areBallsStopped() {
        const motionThreshold = 0.05;
        for (const ball of balls) {
            if (ball.speed > motionThreshold) return false;
        }
        return true;
    }

    // Função para INICIAR a tacada
    function startShot(event) {
        if (areBallsStopped()) {
            isShooting = true;
            const pos = getEventPos(event);
            startDragPos = Vector.create(pos.x, pos.y);
        }
    }

    // Função para MOVER/MIRAR
    function moveShot(event) {
        if (!isShooting) return;
        // Previne o scroll da página no celular
        event.preventDefault(); 
    }

    // Função para FINALIZAR a tacada
    function endShot(event) {
        if (!isShooting) return;
        isShooting = false;

        const endDragPos = Vector.create(getEventPos(event).x, getEventPos(event).y);
        const forceVector = Vector.sub(startDragPos, endDragPos);
        const distance = Vector.magnitude(forceVector);

        if (distance > 10) { // Mínimo arrasto para atirar
            const forceMagnitude = Math.min(distance / 200, 0.05);
            const force = Vector.mult(Vector.normalise(forceVector), forceMagnitude);
            Body.applyForce(cueBall, cueBall.position, force);
        }
    }

    // Função auxiliar para pegar a posição do mouse ou do toque
    function getEventPos(event) {
        if (event.touches) { // É um evento de toque
            return { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
        // É um evento de mouse
        return { x: event.clientX, y: event.clientY };
    }

    // Adicionar os Listeners de Eventos
    render.canvas.addEventListener('mousedown', startShot);
    render.canvas.addEventListener('mousemove', moveShot);
    window.addEventListener('mouseup', endShot);

    render.canvas.addEventListener('touchstart', startShot, { passive: false });
    render.canvas.addEventListener('touchmove', moveShot, { passive: false });
    window.addEventListener('touchend', endShot);
    
    // Desenha a linha de mira
    Events.on(render, 'afterRender', () => {
        if (isShooting && startDragPos) {
            const ctx = render.context;
            const endPos = render.mouse.position;
            ctx.beginPath();
            ctx.moveTo(cueBall.position.x, cueBall.position.y);
            // Inverte a linha para mostrar a direção da força
            const invertedEndX = cueBall.position.x - (endPos.x - startDragPos.x);
            const invertedEndY = cueBall.position.y - (endPos.y - startDragPos.y);
            ctx.lineTo(invertedEndX, invertedEndY);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    // Lógica de encaçapar (semelhante)
    Events.on(engine, 'collisionStart', (event) => {
        event.pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;
            const ball = bodyA.label.includes('ball') ? bodyA : (bodyB.label.includes('ball') ? bodyB : null);
            const pocket = bodyA.label === 'pocket' ? bodyA : (bodyB.label === 'pocket' ? bodyB : null);
            if (ball && pocket) {
                if (ball.label === 'cueBall') {
                    Body.setPosition(cueBall, { x: width / 4, y: height / 2 });
                    Body.setVelocity(cueBall, { x: 0, y: 0 });
                } else {
                    World.remove(world, ball);
                    balls = balls.filter(b => b.id !== ball.id);
                }
            }
        });
    });

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);
});
