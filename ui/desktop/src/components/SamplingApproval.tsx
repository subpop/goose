import { useState, useEffect } from 'react';
import { snakeToTitleCase } from '../utils';
import PermissionModal from './settings/permission/PermissionModal';
import { ChevronRight } from 'lucide-react';
import { confirmPermission, ActionRequired } from '../api';
import { Button } from './ui/button';

const ALLOW_ONCE = 'allow_once';
const DENY = 'deny';

// Global state to track sampling approval decisions
// This persists across navigation within the same session
const samplingApprovalState = new Map<
  string,
  {
    clicked: boolean;
    status: string;
    actionDisplay: string;
  }
>();

interface SamplingApprovalProps {
  sessionId: string;
  isCancelledMessage: boolean;
  isClicked: boolean;
  actionRequiredContent: ActionRequired & { type: 'actionRequired' };
}

export default function SamplingApproval({
  sessionId,
  isCancelledMessage,
  isClicked,
  actionRequiredContent,
}: SamplingApprovalProps) {
  const approvalId = actionRequiredContent.id;

  // Check if we have a stored state for this sampling approval
  const storedState = samplingApprovalState.get(approvalId);

  // Initialize state from stored state if available, otherwise use props/defaults
  const [clicked, setClicked] = useState(storedState?.clicked ?? isClicked);
  const [status, setStatus] = useState(storedState?.status ?? 'unknown');
  const [actionDisplay, setActionDisplay] = useState(storedState?.actionDisplay ?? '');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sync internal state with stored state and props
  useEffect(() => {
    const currentStoredState = samplingApprovalState.get(approvalId);

    // If we have stored state, use it
    if (currentStoredState) {
      setClicked(currentStoredState.clicked);
      setStatus(currentStoredState.status);
      setActionDisplay(currentStoredState.actionDisplay);
    } else if (isClicked && !clicked) {
      // Fallback to prop-based logic for historical confirmations
      setClicked(isClicked);
      if (status === 'unknown') {
        setStatus('confirmed');
        setActionDisplay('confirmed');

        // Store this state for future renders
        samplingApprovalState.set(approvalId, {
          clicked: true,
          status: 'confirmed',
          actionDisplay: 'confirmed',
        });
      }
    }
  }, [isClicked, clicked, status, approvalId]);

  // Only handle sampling approval actions - early return after hooks
  if (actionRequiredContent.actionType !== 'samplingApproval') {
    return null;
  }

  const { extensionName, messages } = actionRequiredContent;

  const handleButtonClick = async (newStatus: string) => {
    let newActionDisplay;

    if (newStatus === ALLOW_ONCE) {
      newActionDisplay = 'approved';
    } else if (newStatus === DENY) {
      newActionDisplay = 'denied';
    } else {
      newActionDisplay = 'denied';
    }

    // Update local state
    setClicked(true);
    setStatus(newStatus);
    setActionDisplay(newActionDisplay);

    // Store in global state for persistence across navigation
    samplingApprovalState.set(approvalId, {
      clicked: true,
      status: newStatus,
      actionDisplay: newActionDisplay,
    });

    try {
      const response = await confirmPermission({
        body: {
          session_id: sessionId,
          id: approvalId,
          action: newStatus,
          principal_type: 'Extension',
        },
      });
      if (response.error) {
        console.error('Failed to confirm sampling approval:', response.error);
      }
    } catch (err) {
      console.error('Error confirming sampling approval:', err);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  // Format the messages for display - simplified to show just the content
  const formatMessages = () => {
    if (!messages || messages.length === 0) {
      return 'No message content';
    }

    return messages
      .map((msg: Record<string, unknown>) => {
        const content = msg.content || msg.text || '';
        return typeof content === 'string' ? content : JSON.stringify(content);
      })
      .join(' ');
  };

  return isCancelledMessage ? (
    <div className="goose-message-content bg-background-muted rounded-2xl px-4 py-2 text-textStandard">
      Sampling approval is cancelled.
    </div>
  ) : (
    <>
      {/* Display the sampling request - simplified */}
      <div className="goose-message-content bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-4 py-2 mb-2 text-blue-800 dark:text-gray-200">
        <div className="mb-2">
          <strong>{extensionName}</strong> wants to send this message to the LLM:
        </div>
        <div className="text-sm bg-white dark:bg-gray-800 rounded p-2 max-h-32 overflow-y-auto">
          {formatMessages()}
        </div>
      </div>

      <div className="goose-message-content bg-background-muted rounded-2xl px-4 py-2 rounded-b-none text-textStandard">
        Allow this request?
      </div>

      {clicked ? (
        <div className="goose-message-tool bg-background-default border border-borderSubtle dark:border-gray-700 rounded-b-2xl px-4 pt-2 pb-2 flex items-center justify-between">
          <div className="flex items-center">
            {status === 'allow_once' && (
              <svg
                className="w-5 h-5 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {status === 'deny' && (
              <svg
                className="w-5 h-5 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {status === 'confirmed' && (
              <svg
                className="w-5 h-5 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="ml-2 text-textStandard">
              {isClicked
                ? 'Sampling approval is not available'
                : `${snakeToTitleCase(extensionName)} sampling ${actionDisplay}`}
            </span>
          </div>

          <div className="flex items-center cursor-pointer" onClick={() => setIsModalOpen(true)}>
            <span className="mr-1 text-textStandard">Change</span>
            <ChevronRight className="w-4 h-4 ml-1 text-iconStandard" />
          </div>
        </div>
      ) : (
        <div className="goose-message-tool bg-background-default border border-borderSubtle dark:border-gray-700 rounded-b-2xl px-4 pt-2 pb-2 flex gap-2 items-center">
          <Button
            className="rounded-full"
            variant="secondary"
            onClick={() => handleButtonClick(ALLOW_ONCE)}
          >
            Approve
          </Button>
          <Button
            className="rounded-full"
            variant="outline"
            onClick={() => handleButtonClick(DENY)}
          >
            Deny
          </Button>
        </div>
      )}

      {/* Modal for updating extension permission */}
      {isModalOpen && <PermissionModal onClose={handleModalClose} extensionName={extensionName} />}
    </>
  );
}
