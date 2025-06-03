import './RovoDev.css';

import React, { useCallback, useState } from 'react';
import { FetchResponseData } from 'src/rovo-dev/utils';

import { useMessagingApi } from '../messagingApi';

const RovoDevView: React.FC = () => {
    const [promptText, setPromptText] = useState('');
    const [responseText, setResponseText] = useState(' ');

    const handleResponse = useCallback(
        (data: FetchResponseData) => {
            console.log('Received response data:', data);
            switch (data.part_kind) {
                case 'text-chunk':
                    setResponseText((prevText) => prevText + data.content);
                    break;
                case 'tool-call':
                    setResponseText((prevText) => prevText + `\n\nTool call: ${data.tool_name}\n\n`);
                    break;
                case 'tool-return':
                    setResponseText(
                        (prevText) => prevText + `\n\nTool return:${data.tool_name} -> ${data.content}\n\n`,
                    );
                    break;
                default:
                    setResponseText((prevText) => prevText + `\n\nUnknown part_kind: ${data.part_kind}\n\n`);
                    break;
            }
        },
        [setResponseText],
    );

    const onMessageHandler = useCallback(
        (message: any): void => {
            switch (message.type) {
                case 'response': {
                    const data = message.dataObject;
                    handleResponse(data);
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
        [handleResponse],
    );

    const [postMessage] = useMessagingApi<any, any, any>(onMessageHandler);

    const sendPrompt = useCallback(
        (text: string): void => {
            setResponseText('');
            postMessage({
                type: 'prompt',
                text,
            });
        },
        [postMessage, setResponseText],
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

    return (
        <div className="rovo-dev-container">
            <textarea
                className="rovo-dev-stream"
                placeholder="...waiting for a response..."
                readOnly={true}
                value={responseText}
            />
            <div className="rovo-dev-prompt-container">
                <textarea
                    className="rovo-dev-textarea"
                    placeholder="What do you want AcraMini to do?"
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
