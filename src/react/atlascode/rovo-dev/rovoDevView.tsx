import React, { useCallback, useState } from 'react';

import { useMessagingApi } from '../messagingApi';

const RovoDevView: React.FC = () => {
    const [promptText, setPromptText] = useState('');
    const [responseText, setResponseText] = useState('');

    const onMessageHandler = useCallback(
        (message: any): void => {
            switch (message.type) {
                case 'response': {
                    setResponseText(responseText + message.text);
                    break;
                }
            }
        },
        [setResponseText, responseText],
    );

    const [postMessage] = useMessagingApi<any, any, any>(onMessageHandler);

    const sendPrompt = useCallback(
        (text: string): void => {
            postMessage({
                type: 'prompt',
                text,
            });
        },
        [postMessage],
    );

    return (
        <div>
            <textarea
                placeholder="What do you want AcraMini to do?"
                onChange={(element) => setPromptText(element.target.value)}
            />
            <br />
            <button onClick={() => sendPrompt(promptText)}>Send</button>

            <br />
            <br />
            <textarea readOnly={true} value={responseText} />
        </div>
    );
};

export default RovoDevView;
