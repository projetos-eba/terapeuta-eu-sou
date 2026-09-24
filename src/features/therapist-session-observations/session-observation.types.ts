export type SessionObservation = {
  bookingId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionObservationAccess = {
  canEdit: boolean;
  observation: SessionObservation | null;
};
