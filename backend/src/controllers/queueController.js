import { evaluatePatientNoShowStatus } from '../services/noShowService.js';

export async function issueWalkinToken(req, res, next) {
  try {
    const { patientName, nic, phone, doctorId } = req.body;
    const noShowEval = await evaluatePatientNoShowStatus(nic);

    const tokenNumber = `#A-${Math.floor(Math.random() * 30 + 10)}`;
    res.status(201).json({
      message: 'Walk-in token issued',
      token: tokenNumber,
      patientName,
      isLateNumber: noShowEval.shouldAssignLateNumber,
      status: noShowEval.shouldAssignLateNumber ? 'Late Queue' : 'Waiting in Lobby'
    });
  } catch (err) {
    next(err);
  }
}

export async function callNextPatient(req, res, next) {
  try {
    const { doctorId } = req.body;
    res.json({ message: 'Next patient called', currentServing: '#A-12', doctorId });
  } catch (err) {
    next(err);
  }
}
