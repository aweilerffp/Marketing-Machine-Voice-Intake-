'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useWorkshopSession } from '../../hooks/useWorkshopSession';
import { phaseType } from '../../lib/constants';
import WelcomeScreen from '../../components/WelcomeScreen';
import VoiceSession from '../../components/voice/VoiceSession';
import GeneratingScreen from '../../components/generation/GeneratingScreen';
import DeliverableView from '../../components/deliverable/DeliverableView';
import CompletionScreen from '../../components/CompletionScreen';

function PhaseContent({ phase }) {
  const type = phaseType(phase);

  switch (type) {
    case 'WELCOME':
      return <WelcomeScreen />;
    case 'INTERVIEW':
      return <VoiceSession />;
    case 'GENERATING':
      return <GeneratingScreen />;
    case 'REVIEW':
      return <DeliverableView />;
    case 'COMPLETE':
      return <CompletionScreen />;
    default:
      return <WelcomeScreen />;
  }
}

export default function WorkshopPage() {
  const { state } = useWorkshopSession();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state.currentPhase}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <PhaseContent phase={state.currentPhase} />
      </motion.div>
    </AnimatePresence>
  );
}
