// src/services/ai/conversation-manager.ts
//
// Key Features:
// - Maintains conversation history
// - Handles context window management
// - Implements memory cleanup
// - Conversation state tracking
// - Context summarization

export class ConversationManager {
    private messages: Array<{ role: string; content: string }>;
    private readonly maxMessages: number;
    private context: Record<string, any>;

    constructor(maxMessages = 10) {
        this.messages = [];
        this.maxMessages = maxMessages;
        this.context = {};
    }

    public addMessage(role: string, content: string): void {
        this.messages.push({ role, content });
        
        // Maintain maximum context window
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }
    }

    public getContext(): Array<{ role: string; content: string }> {
        return [...this.messages];
    }

    public setContext(key: string, value: any): void {
        this.context[key] = value;
    }

    public getContextValue(key: string): any {
        return this.context[key];
    }

    public clear(): void {
        this.messages = [];
        this.context = {};
    }

    public summarizeContext(): string {
        return this.messages
            .map(m => `${m.role}: ${m.content}`)
            .join('\n');
    }
}