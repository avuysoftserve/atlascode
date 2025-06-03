import './RovoDev.css';

import React, { useCallback, useState } from 'react';
import { ChatMessage, FetchResponseData } from 'src/rovo-dev/utils';

import { useMessagingApi } from '../messagingApi';

const RovoDevView: React.FC = () => {
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
                    setCurrentResponse((prevText) => prevText + `\n\nTool call: ${data.tool_name}\n\n`);
                    break;
                case 'tool-return':
                    setCurrentResponse(
                        (prevText) => prevText + `\n\nTool return:${data.tool_name} -> ${data.content}\n\n`,
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
        (message: any): void => {
            console.log('Received message:', message);
            switch (message.type) {
                case 'response': {
                    const data = message.dataObject;
                    handleResponse(data);
                    break;
                }
                case 'userChatMessage': {
                    const userMessage: ChatMessage = {
                        text: message.message.text,
                        author: 'User',
                        timestamp: Date.now(),
                    };
                    setChatHistory((prev) => [...prev, userMessage]);
                    break;
                }

                case 'completeMessage': {
                    console.log('curentResponse:', currentResponse);
                    setChatHistory((prev) => [
                        ...prev,
                        {
                            text: currentResponse,
                            author: 'Agent',
                            timestamp: Date.now(),
                        },
                    ]);
                    setCurrentResponse('');
                    break;
                }

                case 'invokeData': {
                    const prompt = message.prompt;
                    setPromptText(prompt);
                    break;
                }

                default:
                    console.warn('Unknown message type:', message.type);
                    break;
            }
        },
        [handleResponse, currentResponse],
    );

    const [postMessage] = useMessagingApi<any, any, any>(onMessageHandler);

    const sendPrompt = useCallback(
        (text: string): void => {
            // Send the prompt to backend
            postMessage({
                type: 'prompt',
                text,
            });

            // Clear the input field
            setPromptText('');
        },
        [postMessage],
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

    // Render chat message
    const renderChatMessage = (message: ChatMessage, index: number) => {
        return (
            <div key={index} className={`chat-message ${message.author.toLowerCase()}-message`}>
                <div className="message-author">{message.author}</div>
                <div className="message-content">{message.text}</div>
            </div>
        );
    };

    return (
        <div className="rovo-dev-container">
            <div className="chat-messages-container">
                {chatHistory.map((msg, index) => renderChatMessage(msg, index))}

                {/* Show streaming response if available */}
                {currentResponse && (
                    <div className="chat-message agent-message streaming-message">
                        <div className="message-author">Agent</div>
                        <div className="message-content">{currentResponse}</div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="rovo-dev-prompt-container">
                <textarea
                    className="rovo-dev-textarea"
                    placeholder="Edit files in your workspace with Rovo Dev Agent"
                    onChange={(element) => setPromptText(element.target.value)}
                    onKeyDown={handleKeyDown}
                    value={promptText}
                />
                <br />
                <button className="rovo-dev-send-button" onClick={() => sendPrompt(promptText)} title="Send prompt">
                    Send
                </button>
            </div>

            <br />
            <br />
        </div>
    );
};

export default RovoDevView;
