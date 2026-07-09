// ============================
// ZÉ CASTANHA NAS ESTRELAS
// Script v2 — Seções Imersivas
// ============================

const canvas = document.getElementById('spaceCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let stars = [];
const numStars = 600;
let speed = 0.3;
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

// --- PARALLAX ---
document.addEventListener('mousemove', (e) => {
    const offsetX = (e.clientX - width / 2) * 0.06;
    const offsetY = (e.clientY - height / 2) * 0.06;
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
        this.pz = this.z;

        const size = (1 - this.z / width) * 2;
        const opacity = (1 - this.z / width);

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
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
    center.x += (targetX - center.x) * 0.03;
    center.y += (targetY - center.y) * 0.03;

    ctx.fillStyle = 'rgba(3, 3, 5, 0.35)';
    ctx.fillRect(0, 0, width, height);

    stars.forEach(star => {
        star.update();
        star.draw();
    });

    requestAnimationFrame(animate);
}

initStars();
animate();

// --- HAMBURGER MENU ---
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (hamburgerBtn && mobileMenu) {
    hamburgerBtn.addEventListener('click', () => {
        hamburgerBtn.classList.toggle('open');
        mobileMenu.classList.toggle('open');
        // Trava/destrava scroll do body
        document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });
}

function closeMobileMenu() {
    if (hamburgerBtn && mobileMenu) {
        hamburgerBtn.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
    }
}
