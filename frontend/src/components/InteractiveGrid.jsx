import { useEffect, useRef } from 'react';

export default function InteractiveGrid() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Config
    const spacing = 20; // Increased spacing for a cleaner look
    const dotRadius = 2; // Slightly smaller dots
    const repelRadius = 20; // Smaller interaction area
    const repelForce = 0.3; // Much gentler movement
    const returnSpeed = 0.1; // Faster snapping back
    const friction = 0.5 // Less "wobble"

    let nodes = [];
    let mouse = { x: -1000, y: -1000, radius: repelRadius };

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      nodes = [];
      const cols = Math.floor(canvas.width / spacing) + 2;
      const rows = Math.floor(canvas.height / spacing) + 2;

      for (let i = 0; i < cols; i++) {
        nodes[i] = [];
        for (let j = 0; j < rows; j++) {
          nodes[i][j] = {
            originX: i * spacing,
            originY: j * spacing,
            x: i * spacing,
            y: j * spacing,
            vx: 0,
            vy: 0
          };
        }
      }
    };

    const draw = () => {
      // Instead of clearRect, we fill with the background color to act as the base layer
      ctx.fillStyle = '#ECE7D1'; // Matching your --color-background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // We'll use your brand's primary color with MUCH lower opacity for a subtle look
      const lineColor = 'rgba(138, 118, 80, 0.08)';
      const dotColor = 'rgba(138, 118, 80, 0.15)';

      // Update positions
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes[i].length; j++) {
          const dot = nodes[i][j];
          const dx = mouse.x - dot.x;
          const dy = mouse.y - dot.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            // repel
            const pushX = (dx / dist) * force * repelForce * 10;
            const pushY = (dy / dist) * force * repelForce * 10;
            dot.vx -= pushX;
            dot.vy -= pushY;
          }

          dot.vx += (dot.originX - dot.x) * returnSpeed;
          dot.vy += (dot.originY - dot.y) * returnSpeed;
          dot.vx *= friction;
          dot.vy *= friction;
          dot.x += dot.vx;
          dot.y += dot.vy;
        }
      }

      // Draw lines
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes[i].length; j++) {
          const dot = nodes[i][j];
          if (i < nodes.length - 1) {
            ctx.moveTo(dot.x, dot.y);
            ctx.lineTo(nodes[i + 1][j].x, nodes[i + 1][j].y);
          }
          if (j < nodes[i].length - 1) {
            ctx.moveTo(dot.x, dot.y);
            ctx.lineTo(nodes[i][j + 1].x, nodes[i][j + 1].y);
          }
        }
      }
      ctx.stroke();

      // Draw dots
      ctx.fillStyle = dotColor;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes[i].length; j++) {
          const dot = nodes[i][j];
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseLeave);
    window.addEventListener('resize', handleResize);

    init();
    draw();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: -1,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        background: 'transparent',
      }}
    />
  );
}
