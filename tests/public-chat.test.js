import { afterEach, describe, expect, it, vi } from 'vitest';
import { Message, UsageRecord } from '../src/models/index.js';
import { PublicChatService } from '../src/services/public-chat.service.js';

describe('grounded public chat', () => {
  afterEach(()=>vi.restoreAllMocks());
  it('streams a supported response with source references', async () => {
    const provider={async *streamAnswer(){yield{text:'Our policy ',usage:{}};yield{text:'allows it.',usage:{}}}},retrieval={retrieve:vi.fn().mockResolvedValue({status:'supported',chunks:[{sourceId:'s',sourceName:'Returns',chunkIndex:0,score:.9,text:'Returns allowed'}]})};
    vi.spyOn(Message,'create').mockResolvedValue({_id:'m'});vi.spyOn(UsageRecord,'create').mockResolvedValue({});const conversation={_id:'c',publicId:'con',save:vi.fn()};const events=[];for await(const e of new PublicChatService({provider,retrieval}).answer({organizationId:'o',bot:{_id:'b',instructions:''},conversation,question:'Can I return it?'}))events.push(e);
    expect(events.filter(e=>e.type==='delta').map(e=>e.text).join('')).toBe('Our policy allows it.');expect(events.at(-1).sources[0].name).toBe('Returns');expect(events.at(-1).status).toBe('supported');
  });
});
