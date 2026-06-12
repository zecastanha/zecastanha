const canvas = document.getElementById('spaceCanvas');
const ctx = canvas.getContext('2d');
const btnEmbarcar = document.getElementById('btnEmbarcar');
const initialState = document.getElementById('initialState');
const finalState = document.getElementById('finalState');
const flashOverlay = document.getElementById('flashOverlay');

// Canvas dimensions
let width, height;

// Star properties
let stars = [];
const numStars = 800;
let speed = 0.5; // Initial slow speed
let isHyperspace = false;
let center = { x: 0, y: 0 };
let targetX = 0;
let targetY = 0;

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    center.x = width / 2;
    center.y = height / 2;
    targetX = center.x;
    targetY = center.y;
}

window.addEventListener('resize', resize);
resize();

// --- PARALLAX EFEITO ---
document.addEventListener('mousemove', (e) => {
    if (!isHyperspace) {
        // Movimento leve inverso (10% de offset)
        const offsetX = (e.clientX - width / 2) * 0.1;
        const offsetY = (e.clientY - height / 2) * 0.1;
        targetX = (width / 2) + offsetX;
        targetY = (height / 2) + offsetY;
    } else {
        // Trava no centro durante o hiperespaço
        targetX = width / 2;
        targetY = height / 2;
    }
});

// --- AUDIO DESIGN ---
const portalSound = new Audio('portal.MP3'); // Respeitando maiúsculas para Linux/Vercel

function playHyperspaceSound() {
    portalSound.currentTime = 0;
    portalSound.play().catch(err => {
        console.log("Para o som funcionar, coloque um arquivo chamado 'portal.mp3' na mesma pasta do site.");
    });
}

class Star {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = (Math.random() - 0.5) * width * 2;
        this.y = (Math.random() - 0.5) * height * 2;
        this.z = Math.random() * width;
        this.pz = this.z;
    }

    update() {
        this.z -= speed;
        
        // Reset if star goes behind camera
        if (this.z < 1) {
            this.reset();
            this.z = width; // Start from furthest distance
            this.pz = this.z;
        }
    }

    draw() {
        const sx = (this.x / this.z) * width + center.x;
        const sy = (this.y / this.z) * height + center.y;
        
        const px = (this.x / this.pz) * width + center.x;
        const py = (this.y / this.pz) * height + center.y;

        this.pz = this.z;

        // Size decreases as star is further away
        const size = (1 - this.z / width) * 2.5;

        // Draw star or line (if in hyperspace)
        ctx.beginPath();
        if (isHyperspace && speed > 5) {
            ctx.strokeStyle = '#00BFFF'; // Azul no estilo Star Wars
            ctx.lineWidth = size;
            ctx.moveTo(px, py);
            ctx.lineTo(sx, sy);
            ctx.stroke();
        } else {
            ctx.fillStyle = 'white';
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function initStars() {
    for (let i = 0; i < numStars; i++) {
        stars.push(new Star());
    }
}

function animate() {
    // Interpolação suave do parallax
    center.x += (targetX - center.x) * 0.05;
    center.y += (targetY - center.y) * 0.05;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Create trail effect for motion blur
    ctx.fillRect(0, 0, width, height);

    stars.forEach(star => {
        star.update();
        star.draw();
    });

    requestAnimationFrame(animate);
}

initStars();
animate();

// --- LOGICA DE TRANSIÇÃO ---

btnEmbarcar.addEventListener('click', () => {
    // Tocar Som de Hiperespaço
    playHyperspaceSound();

    // 1. Ocultar estado inicial
    initialState.classList.remove('active');
    initialState.classList.add('hidden');

    // Fase 1: Zoom In leve (estrelas aceleram pouco a pouco, sem esticar)
    let zoomInterval = setInterval(() => {
        speed += 0.2;
        if (speed > 8) clearInterval(zoomInterval);
    }, 20);

    // Fase 2: Esticar (Hiperespaço sem tremer)
    setTimeout(() => {
        clearInterval(zoomInterval);
        isHyperspace = true; // Começa a desenhar linhas azuis
        
        let stretchInterval = setInterval(() => {
            speed += 4;
            if (speed > 120) clearInterval(stretchInterval);
        }, 20);

        // Fase 3: Tremer (Viagem no hiperespaço)
        setTimeout(() => {
            document.body.classList.add('shake-effect');

            // Fase 4: Flash e Revelar
            setTimeout(() => {
                flashOverlay.classList.add('flash');
                
                // Desacelerar
                let deceleration = setInterval(() => {
                    speed -= 5;
                    if (speed <= 1) {
                        speed = 1;
                        isHyperspace = false;
                        clearInterval(deceleration);
                    }
                }, 20);

                document.body.classList.remove('shake-effect');

                finalState.classList.remove('hidden');
                finalState.classList.add('active');

                setTimeout(() => {
                    flashOverlay.classList.remove('flash');
                }, 300);

            }, 1000); // Duração do tremor: 1s

        }, 1000); // Duração do esticar sem tremer: 1s

    }, 1000); // Duração do zoom inicial: 1s
});

// --- LOGICA DO EVENTO FINAL ---
function triggerFinalEvent() {
    document.getElementById('finalLogo').src = 'assets/FUNDO%201%20PNG%20deitada.png';
    document.getElementById('saveTitle').style.display = 'block';
    document.getElementById('finalDate').innerText = '18.09.2026';
    document.getElementById('finalSubcopy').innerText = 'O plano era voltar pra Bauru. Deu tudo errado.';
    
    // Esconde o relógio
    const countdownContainer = document.querySelector('.countdown-container');
    if (countdownContainer) countdownContainer.style.display = 'none';
}

// --- LOGICA DE CONTAGEM REGRESSIVA ---

const targetDate = new Date('2026-06-21T18:00:00').getTime();

const daysEl = document.getElementById('days');
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');

function updateCountdown() {
    const now = new Date().getTime();
    const distance = targetDate - now;

    if (distance < 0) {
        // Já passou da data, dispara o evento final
        triggerFinalEvent();
        return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    daysEl.innerText = days.toString().padStart(2, '0');
    hoursEl.innerText = hours.toString().padStart(2, '0');
    minutesEl.innerText = minutes.toString().padStart(2, '0');
    secondsEl.innerText = seconds.toString().padStart(2, '0');
}

setInterval(updateCountdown, 1000);
updateCountdown(); // Chamada inicial para evitar delay de 1 seg

// Sem navegação por abas aqui, será via links multi-page.
