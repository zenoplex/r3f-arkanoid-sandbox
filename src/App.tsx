import React from 'react';
import { Canvas, useFrame, useThree, useLoader } from 'react-three-fiber';
import {
  Physics,
  useSphere,
  useBox,
  usePlane,
  Event,
} from '@react-three/cannon';
import {
  BoxBufferGeometry,
  MeshPhysicalMaterial,
  RepeatWrapping,
  sRGBEncoding,
  TextureLoader,
  Vector3,
} from 'three';
import { Stats } from '@react-three/drei';
import './App.css';

interface BallProps {
  isReset: boolean;
  onReset: () => void;
}

const Ball = ({ isReset, onReset }: BallProps): JSX.Element => {
  const [ref, api] = useSphere(() => ({
    args: 0.5,
    mass: 1,
    position: [0, -3, 0],
    velocity: [Math.random() * 6 - 3, -10, 0],
  }));

  useFrame(() => {
    if (isReset) {
      api.position.set(0, -3, 0);
      api.velocity.set(Math.random() * 6 - 3, -10, 0);
      api.angularVelocity.set(0, 0, 0);
      onReset();
    }
  });

  return (
    <mesh ref={ref} castShadow name="ball">
      <sphereBufferGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
};

const Paddle = (): JSX.Element => {
  const [ref, api] = useBox(() => ({
    type: 'Kinematic',
    material: { restitution: 10 },
    args: [3, 0.5, 1],
  }));

  useFrame((state) => {
    api.position.set(
      (state.mouse.x * state.viewport.width) / 2,
      -state.viewport.height / 2,
      0
    );
    api.rotation.set(0, 0, (state.mouse.x * Math.PI) / 10);
  });

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxBufferGeometry args={[3, 0.5, 1]} />
      <meshStandardMaterial color="lightblue" />
    </mesh>
  );
};

interface BoundaryProps {
  onOutBound: (e: Event) => void;
}

const Boundary = ({ onOutBound }: BoundaryProps): JSX.Element => {
  const { viewport } = useThree();
  // useLoader causes flickering
  // const [texture, normal] = useLoader(TextureLoader, [
  //   '/carbon.png',
  //   '/carbon_normal.png',
  // ]);

  const [texture, normal] = React.useMemo(() => {
    const loader = new TextureLoader();
    const textures = ['/carbon.png', '/carbon_normal.png'].map((image) =>
      loader.load(image)
    );

    textures[0].encoding = sRGBEncoding;
    textures[0].wrapS = RepeatWrapping;
    textures[0].wrapT = RepeatWrapping;
    textures[0].repeat.x = 100;
    textures[0].repeat.y = 100;
    textures[1].wrapS = RepeatWrapping;
    textures[1].wrapT = RepeatWrapping;

    return textures;
  }, []);

  const [refRight, apiRight] = usePlane(() => ({
    type: 'Static',
    rotation: [Math.PI / 2, -Math.PI / 2, 0],
    material: { friction: 1, restitution: 2 },
  }));
  const [refBottom, apiBottom] = usePlane(() => ({
    type: 'Static',
    rotation: [-Math.PI / 2, 0, 0],
    onCollide: onOutBound,
  }));
  const [refLeft, apiLeft] = usePlane(() => ({
    type: 'Static',
    rotation: [-Math.PI / 2, Math.PI / 2, 0],
  }));
  const [refTop, apiTop] = usePlane(() => ({
    type: 'Static',
    rotation: [Math.PI / 2, 0, 0],
  }));

  const { width, height } = viewport;

  const geometry = React.useMemo(() => {
    return new BoxBufferGeometry(width, 100);
  }, [width]);

  const material = React.useMemo(() => {
    return new MeshPhysicalMaterial({
      roughness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      map: texture,
      normalMap: normal,
    });
  }, [normal, texture]);

  React.useLayoutEffect(() => {
    apiRight.position.set(width / 2, 0, 0);
    apiBottom.position.set(0, -height / 2 - 2, 0);
    apiLeft.position.set(-width / 2, 0, 0);
    apiTop.position.set(0, height / 2, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, width]);

  return (
    <>
      <mesh
        ref={refRight}
        geometry={geometry}
        material={material}
        receiveShadow
      />
      <mesh
        ref={refBottom}
        geometry={geometry}
        material={material}
        receiveShadow
      />
      <mesh
        ref={refLeft}
        geometry={geometry}
        material={material}
        receiveShadow
      />
      <mesh
        ref={refTop}
        geometry={geometry}
        material={material}
        receiveShadow
      />
    </>
  );
};

interface BlockProps {
  name: string;
  position: number[];
  onCollide: (e: Event) => void;
}

const Block = ({ position, name, onCollide }: BlockProps): JSX.Element => {
  const [ref] = useBox(() => ({
    args: [2, 0.5, 1],
    position,
    onCollide,
  }));

  return (
    <mesh ref={ref} castShadow name={name}>
      <boxBufferGeometry args={[2, 0.5, 1]} />
      <meshStandardMaterial color="skyblue" />
    </mesh>
  );
};

const Camera = (): null => {
  useFrame((state) => {
    state.camera.position.lerp(
      new Vector3(
        state.mouse.x * 5,
        state.camera.position.y,
        state.camera.position.z
      ),
      0.1
    );

    state.camera.updateProjectionMatrix();
  });

  return null;
};

const Scene = (): JSX.Element => {
  const [isReset, setIsReset] = React.useState(false);

  const onOutBound = React.useCallback(() => {
    setIsReset(true);
  }, []);

  const onReset = React.useCallback(() => {
    setIsReset(false);
  }, []);

  const { viewport } = useThree();
  const barWidth = 2;
  const barHeight = 0.5;
  const xGap = 0.1;
  const yGap = 0.5;

  const [blocks, setBlocks] = React.useState<
    { name: string; position: number[] }[]
  >([]);

  React.useEffect(() => {
    const temp = [];
    const xCount = Math.floor(
      (viewport.width - barWidth * 4) / (barWidth + xGap) + xGap
    );
    const yCount = 5;

    let count = 0;

    for (let i = 0; i < yCount; i++) {
      for (let j = 0; j < xCount; j++) {
        count = count + 1;
        temp.push({
          name: `block-${count}`,
          position: [
            (barWidth + xGap) * j -
              ((barWidth + xGap) * xCount) / 2 +
              barWidth / 2,
            -(barHeight + yGap) * i +
              (viewport.height / 2 - (barHeight + yGap) * 2),
            0,
          ],
        });
      }
    }

    setBlocks(temp);
  }, []);

  const onCollide = React.useCallback((e) => {
    setBlocks((s) =>
      s.filter(({ name }) => {
        return e.target.name !== name;
      })
    );
  }, []);

  return (
    <>
      <Camera />
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} castShadow />
      <pointLight position={[-5, -5, -5]} intensity={0.8} castShadow />

      <Physics
        size={100}
        gravity={[0, 0, 0]}
        defaultContactMaterial={{
          restitution: 1.05,
          friction: 10,
        }}
      >
        <Ball isReset={isReset} onReset={onReset} />
        <Paddle />
        <React.Suspense fallback={null}>
          <Boundary onOutBound={onOutBound} />
        </React.Suspense>
        {blocks.map(({ name, position }, i) => (
          <Block
            position={position}
            key={name}
            name={name}
            onCollide={onCollide}
          />
        ))}
      </Physics>
    </>
  );
};

const App = (): JSX.Element => {
  return (
    <Canvas
      gl={{ antialias: true }}
      camera={{ position: [0, 5, 30], fov: 35 }}
      shadowMap
    >
      <Scene />
      <Stats />
    </Canvas>
  );
};

export default App;
