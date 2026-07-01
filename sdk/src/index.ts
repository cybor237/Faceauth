/**
 * Point d'entrée public du SDK FaceAuth.
 *
 * Usage (ESM) :
 *   import { FaceAuth } from '@faceauth/sdk';
 *   const faceauth = new FaceAuth({ apiKey: 'sk_live_xxx' });
 *   const result = await faceauth.verify({ endUserId: 'user_123' });
 *
 * Usage (script classique) :
 *   <script src="faceauth.js"></script>
 *   <script>
 *     const faceauth = new FaceAuth.FaceAuth({ apiKey: 'sk_live_xxx' });
 *   </script>
 */

export { FaceAuth } from "./FaceAuth";
export type {
  FaceAuthConfig,
  FaceAuthResult,
  FaceAuthSuccessResult,
  FaceAuthErrorResult,
  FaceAuthErrorCode,
  FaceAuthActionOptions,
  GestureType,
  LivenessAttestation,
  LivenessGestureEvent,
} from "./types";
