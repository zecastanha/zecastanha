const canvas = document.getElementById('spaceCanvas');
const ctx = canvas.getContext('2d');

// Canvas dimensions
let width, height;

// Star properties
let stars = [];
const numStars = 500; // Menos estrelas para a tela de leitura ficar mais calma
let speed = 0.5; // Velocidade lenta e constante
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

// Parallax leve
document.addEventListener('mousemove', (e) => {
    const offsetX = (e.clientX - width / 2) * 0.05;
    const offsetY = (e.clientY - height / 2) * 0.05;
    targetX = (width / 2) + offsetX;
    targetY = (height / 2) + offsetY;
});

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
        if (this.z < 1) {
            this.reset();
            this.z = width;
            this.pz = this.z;
        }
    }

    draw() {
        const sx = (this.x / this.z) * width + center.x;
        const sy = (this.y / this.z) * height + center.y;
        const px = (this.x / this.pz) * width + center.x;
        const py = (this.y / this.pz) * height + center.y;

        this.pz = this.z;

        const size = (1 - this.z / width) * 2;

        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initStars() {
    for (let i = 0; i < numStars; i++) {
        stars.push(new Star());
    }
}

function animate() {
    center.x += (targetX - center.x) * 0.05;
    center.y += (targetY - center.y) * 0.05;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; 
    ctx.fillRect(0, 0, width, height);

    stars.forEach(star => {
        star.update();
        star.draw();
    });

    requestAnimationFrame(animate);
}

initStars();
animate();

// --- LÓGICA DO MODAL ---

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        // Pequeno atraso para a transição do CSS acontecer após remover o display:none
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
        document.body.style.overflow = 'hidden'; // Impede scroll do body
        
        // Atualiza a URL sem recarregar
        const hashName = modalId.replace('modal-', '');
        window.history.pushState(null, null, '#' + hashName);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        // Aguarda a transição de opacidade terminar antes de esconder de fato
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
        document.body.style.overflow = '';
        
        // Limpa o hash
        window.history.pushState(null, null, window.location.pathname);
    }
}

// Fechar clicando fora do conteúdo
document.querySelectorAll('.story-modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal.id);
        }
    });
});

// Ao carregar a página, checar se tem hash
window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash;
    if (hash === '#lasvegas' || hash === '#las-vegas') openModal('modal-lasvegas');
    if (hash === '#tokyodrift' || hash === '#tokyo-drift') openModal('modal-tokyodrift');
    if (hash === '#sexta13' || hash === '#sexta-feira-13') openModal('modal-sexta13');
    if (hash === '#madagascar') openModal('modal-madagascar');
});
