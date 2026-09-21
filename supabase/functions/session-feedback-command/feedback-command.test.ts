import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { DomainError } from "../_shared/payments/http.ts";
import { validateSessionFeedbackCommand } from "./feedback-command.ts";
const base = { contractVersion: 2, bookingId: "96000000-0000-4000-8000-000000000001",
  sessionAttemptId: "96000000-0000-4000-8000-000000000002",
  requestId: "96000000-0000-4000-8000-000000000099" };
Deno.test("quality v2 positive requires rating and preserves attempt", () => {
  const result=validateSessionFeedbackCommand({...base, successful:true, rating:5, qualityReason:null,comment:"  Estável. "});
  assertEquals(result,{...base,contractVersion:2,successful:true,rating:5,qualityReason:null,comment:"Estável."});
});
Deno.test("negative quality requires technical reason and cannot carry stars", () => {
  const result=validateSessionFeedbackCommand({...base,successful:false,rating:null,qualityReason:"internet_problem"});
  assertEquals(result.successful,false); assertEquals(result.qualityReason,"internet_problem");
});
Deno.test("legacy, stale contract, forbidden reasons, ratings and long comments rejected", () => {
  for(const body of [
    {bookingId:base.bookingId,requestId:base.requestId,outcome:"not_performed",notPerformedReason:"therapist_absent"},
    {...base,contractVersion:1,successful:true,rating:5},
    {...base,sessionAttemptId:"invalid",successful:true,rating:5},
    {...base,successful:true,rating:null},
    {...base,successful:false,rating:5,qualityReason:"other"},
    {...base,successful:false,qualityReason:"rescheduled"},
    {...base,successful:false,qualityReason:"late_cancellation"},
    {...base,successful:false,qualityReason:"therapist_absent"},
    {...base,successful:false,qualityReason:"other",comment:"x".repeat(501)},
    {...base,successful:true,rating:5,outcome:"completed"},
  ]) { const error=assertThrows(()=>validateSessionFeedbackCommand(body));
    assertEquals(error instanceof DomainError,true); assertEquals((error as DomainError).code,"VALIDATION_ERROR"); }
});
