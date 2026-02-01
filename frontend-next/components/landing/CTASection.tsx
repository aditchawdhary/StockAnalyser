'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import Button from '../shared/Button';
import * as THREE from 'three';

const CTASection: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 80;
    camera.position.x = 0;
    camera.position.y = 0;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 1); // Black background
    mountRef.current.appendChild(renderer.domElement);

    // Create elegant double helix
    const helixGroup = new THREE.Group();

    const radius = 48; // Much wider radius for screen-spanning effect
    const height = 108;
    const turns = 10;
    const pointsPerTurn = 90;
    const totalPoints = turns * pointsPerTurn;

    const helix1Points: THREE.Vector3[] = [];
    const helix2Points: THREE.Vector3[] = [];

    for (let i = 0; i <= totalPoints; i++) {
      const t = i / pointsPerTurn;
      const angle = t * Math.PI * 2;
      const y = (t / turns) * height - height / 2;

      const x1 = radius * Math.cos(angle);
      const z1 = radius * Math.sin(angle);
      helix1Points.push(new THREE.Vector3(x1, y, z1));

      const x2 = radius * Math.cos(angle + Math.PI);
      const z2 = radius * Math.sin(angle + Math.PI);
      helix2Points.push(new THREE.Vector3(x2, y, z2));
    }

    // Sleek tubes
    const curve1 = new THREE.CatmullRomCurve3(helix1Points);
    const tubeGeometry1 = new THREE.TubeGeometry(curve1, totalPoints, 0.25, 12, false);
    const tubeMaterial1 = new THREE.MeshStandardMaterial({
      color: 0x10b981, // Green color matching your theme
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x059669,
      emissiveIntensity: 0.3
    });
    const tube1 = new THREE.Mesh(tubeGeometry1, tubeMaterial1);
    helixGroup.add(tube1);

    const curve2 = new THREE.CatmullRomCurve3(helix2Points);
    const tubeGeometry2 = new THREE.TubeGeometry(curve2, totalPoints, 0.25, 12, false);
    const tubeMaterial2 = new THREE.MeshStandardMaterial({
      color: 0x14b8a6, // Teal color matching your theme
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0d9488,
      emissiveIntensity: 0.3
    });
    const tube2 = new THREE.Mesh(tubeGeometry2, tubeMaterial2);
    helixGroup.add(tube2);

    scene.add(helixGroup);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x10b981, 2);
    pointLight1.position.set(10, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x14b8a6, 1.5);
    pointLight2.position.set(-10, -5, 5);
    scene.add(pointLight2);

    // Smooth animation
    let time = 0;
    function animate() {
      requestAnimationFrame(animate);

      time += 0.1;
      helixGroup.rotation.y = time;
      helixGroup.position.y = Math.sin(time * 0.4) * 0.3;

      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      tubeGeometry1.dispose();
      tubeGeometry2.dispose();
      tubeMaterial1.dispose();
      tubeMaterial2.dispose();
    };
  }, []);

  return (
    <section className="py-20 bg-black min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* 3D Helix Background */}
      <div ref={mountRef} className="absolute inset-0 z-0 opacity-40" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
          Ready to Start Tracking?
        </h2>
        <p className="text-lg md:text-xl text-white/90 mb-8">
          Join thousands of investors making smarter decisions
        </p>
        <Link href="/dashboard">
          <Button
            variant="secondary"
            className="bg-white text-rh-teal-500 hover:bg-gray-50 border-none shadow-xl hover:shadow-2xl"
          >
            Get Started Now
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default CTASection;
