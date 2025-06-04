import React, { useCallback, useState } from 'react';
import { ChatMessage, FetchResponseData } from 'src/rovo-dev/utils';

import { useMessagingApi } from '../messagingApi';
import * as styles from './rovoDevViewStyles';

const RovoDevView: React.FC = () => {
    const [sendButtonDisabled, setSendButtonDisabled] = useState(false);
    const [promptText, setPromptText] = useState('');
    const [currentResponse, setCurrentResponse] = useState('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const chatEndRef = React.useRef<HTMLDivElement>(null);

    // Scroll to bottom when chat updates
    React.useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, currentResponse]);

    const handleResponse = useCallback(
        (data: FetchResponseData) => {
            console.log('Received response data:', data);
            switch (data.part_kind) {
                case 'text-chunk':
                    setCurrentResponse((prevText) => prevText + (data.content || ''));
                    break;
                case 'tool-call':
                    setCurrentResponse(
                        (prevText) => prevText + `\n\n<TOOL_CALL>${data.tool_name}@@@@${data.args}</TOOL_CALL>\n\n`,
                    );
                    break;
                case 'tool-return':
                    setCurrentResponse(
                        (prevText) => prevText + `\n\nTool return: ${data.tool_name} -> ${data.content}\n\n`,
                    );
                    break;
                default:
                    setCurrentResponse((prevText) => prevText + `\n\nUnknown part_kind: ${data.part_kind}\n\n`);
                    break;
            }
        },
        [setCurrentResponse],
    );

    const onMessageHandler = useCallback(
        (event: any): void => {
            switch (event.type) {
                case 'response': {
                    const data = event.dataObject;
                    handleResponse(data);
                    break;
                }
                case 'userChatMessage': {
                    setChatHistory((prev) => [...prev, event.message]);
                    break;
                }

                case 'completeMessage': {
                    setChatHistory((prev) => [
                        ...prev,
                        {
                            text: currentResponse,
                            author: 'Agent',
                            timestamp: Date.now(),
                        },
                    ]);
                    setCurrentResponse('');
                    setSendButtonDisabled(false);
                    break;
                }

                case 'errorMessage': {
                    setChatHistory((prev) => [...prev, event.message]);
                    setSendButtonDisabled(false);
                    break;
                }

                case 'invokeData': {
                    const prompt = event.prompt;
                    setPromptText(prompt);
                    break;
                }

                default:
                    console.warn('Unknown message type:', event.type);
                    break;
            }
        },
        [handleResponse, currentResponse],
    );

    const [postMessage] = useMessagingApi<any, any, any>(onMessageHandler);

    const sendPrompt = useCallback(
        (text: string): void => {
            if (sendButtonDisabled) {
                return;
            }

            // Disable the send button
            setSendButtonDisabled(true);

            // Send the prompt to backend
            postMessage({
                type: 'prompt',
                text,
            });

            // Clear the input field
            setPromptText('');
        },
        [postMessage, sendButtonDisabled, setSendButtonDisabled],
    );

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendPrompt(promptText);
            }
        },
        [sendPrompt, promptText],
    );

    // Function to render message content with tool call highlighting
    const renderMessageContent = (text: string) => {
        // Split the text by tool call markers
        const parts = text.split(/(<TOOL_CALL>.*?<\/TOOL_CALL>)/g);

        return parts.map((part, index) => {
            if (part.match(/^<TOOL_CALL>.*<\/TOOL_CALL>$/)) {
                // Extract tool call information
                const toolCallContent = part.replace(/^<TOOL_CALL>/, '').replace(/<\/TOOL_CALL>$/, '');
                const [toolName, argsStr] = toolCallContent.split('@@@@');

                return (
                    <div key={index} style={styles.toolCallBubbleStyles}>
                        <div style={styles.toolCallHeaderStyles}>
                            <span style={styles.toolCallIconStyles}>🔧</span>
                            <span style={styles.toolCallNameStyles}>{toolName}</span>
                        </div>
                        {argsStr && (
                            <div style={styles.toolCallArgsStyles}>
                                <pre style={styles.toolCallArgsPreStyles}>{argsStr}</pre>
                            </div>
                        )}
                    </div>
                );
            } else {
                // Regular text content
                return part ? <span key={index}>{part}</span> : null;
            }
        });
    };

    // Render chat message
    const renderChatMessage = (message: ChatMessage, index: number) => {
        const messageTypeStyles =
            message.author.toLowerCase() === 'user' ? styles.userMessageStyles : styles.agentMessageStyles;
        return (
            <div key={index} style={{ ...styles.chatMessageStyles, ...messageTypeStyles }}>
                <div style={styles.messageHeaderStyles}>
                    <span style={styles.messageAuthorStyles}>{message.author}</span>
                    <span style={styles.messageTimestampStyles}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                </div>
                <div style={styles.messageContentStyles}>{renderMessageContent(message.text)}</div>
            </div>
        );
    };

    return (
        <div style={styles.rovoDevContainerStyles}>
            <div style={styles.chatMessagesContainerStyles}>
                {chatHistory.map((msg, index) => renderChatMessage(msg, index))}

                {/* Show streaming response if available */}
                {currentResponse && (
                    <div
                        style={{
                            ...styles.chatMessageStyles,
                            ...styles.agentMessageStyles,
                            ...styles.streamingMessageStyles,
                        }}
                    >
                        <div style={styles.messageHeaderStyles}>
                            <span style={styles.messageAuthorStyles}>Agent</span>
                            <span style={styles.messageTimestampStyles}>{new Date().toLocaleTimeString()}</span>
                        </div>
                        <div style={styles.messageContentStyles}>{renderMessageContent(currentResponse)}</div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <div style={styles.rovoDevPromptContainerStyles}>
                <textarea
                    style={styles.rovoDevTextareaStyles}
                    placeholder="Edit files in your workspace with Rovo Dev Agent"
                    onChange={(element) => setPromptText(element.target.value)}
                    onKeyDown={handleKeyDown}
                    value={promptText}
                />
                <br />
                <button onClick={() => sendPrompt(promptText)} title="Send prompt" disabled={sendButtonDisabled}>
                    Send
                </button>
            </div>

            <br />
            <br />
        </div>
    );
};

export default RovoDevView;
