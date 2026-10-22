import { logLocalProtocolDiagnostic } from './protocol-diagnostic';
afterEach(()=>jest.restoreAllMocks());
test.each([undefined,'','other'])('is silent outside the explicit local mode: %s',mode=>{
 jest.replaceProperty(process,'env',{...process.env,ZEW_LOCAL_PLAYTEST:mode});const info=jest.spyOn(console,'info').mockImplementation(()=>{});
 logLocalProtocolDiagnostic('initial','PRIVATE_NARRATION [LOKACJA: PRIVATE_LABEL]',false,['movement']);expect(info).not.toHaveBeenCalled();
});
test('emits only protocol counts and allowlisted categories, with correction flag',()=>{
 jest.replaceProperty(process,'env',{...process.env,ZEW_LOCAL_PLAYTEST:'prabuty-tomasz'});const info=jest.spyOn(console,'info').mockImplementation(()=>{});
 logLocalProtocolDiagnostic('initial','PRIVATE_NARRATION [LOKACJA: secret-id] [LOCATION: OFF_GRAPH | PRIVATE_LABEL] [AKTUALNY CZAS: 19 Października 1973, 03:20]',true,['movement','PRIVATE_REASON','movement']);
 expect(info).toHaveBeenCalledWith('[local-dossier-protocol]',{stage:'initial',correction:true,counts:{locationPl:1,locationEn:1,offGraph:1,time:1},violationTypes:['movement']});
 expect(JSON.stringify(info.mock.calls)).not.toMatch(/PRIVATE_|secret-id|Października/);
});
