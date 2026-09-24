import { MotionConfig } from 'motion/react';
import { InputTestPage } from '../features/input-test/InputTestPage';
import { StudioPage } from '../features/studio/StudioPage';
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      {new URLSearchParams(location.search).get('view') === 'input-test' ? (
        <InputTestPage />
      ) : (
        <StudioPage />
      )}
    </MotionConfig>
  );
}
