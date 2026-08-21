/**
 * Signalement d'erreurs factuelles reelles : bouton, capture, rapport.
 *
 * Regroupe les 4 composants du parcours pour que `GameScreen` n'ait qu'un
 * seul point de branchement.
 */

import { useState } from 'react';

import FlagButton from './FlagButton';
import FlagCaptureModal from './FlagCaptureModal';
import FlagReportForm from './FlagReportForm';
import FlagToast from './FlagToast';

function FlagLayer({ articleTitle, articleUrl, paragraphs, sessionContext, finished }) {
  const [flagged, setFlagged] = useState([]);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  return (
    <>
      {!finished && (
        <FlagButton onClick={() => setCaptureOpen(true)} count={flagged.length} />
      )}

      {captureOpen && (
        <FlagCaptureModal
          articleTitle={articleTitle}
          paragraphs={paragraphs}
          onSubmit={(item) => {
            setFlagged((prev) => [...prev, item]);
            setCaptureOpen(false);
            setToast(true);
          }}
          onClose={() => setCaptureOpen(false)}
        />
      )}

      {toast && <FlagToast onDone={() => setToast(false)} />}

      {finished && flagged.length > 0 && !reportDone && (
        <FlagReportForm
          flaggedItems={flagged}
          articleTitle={articleTitle}
          articleUrl={articleUrl}
          sessionContext={sessionContext}
          onDone={() => setReportDone(true)}
        />
      )}
    </>
  );
}

export default FlagLayer;
