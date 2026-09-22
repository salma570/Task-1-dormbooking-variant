import joi from 'joi';
import { Booking } from '../models/Booking.js';

// TODO: write a validation schema for create/update per README.md section 2.
const bookingSchema = joi.object({
  roomNumber: joi.string().required(),
  startDate: joi.date().required(),
  endDate: joi.date().required().greater(joi.ref('startDate')),
  purpose: joi.string().optional(),
  bookedBy: joi.string().optional(),
});

const bookingUpdateSchema = joi.object({
  roomNumber: joi.string().required(),
  startDate: joi.date().required(),
  endDate: joi.date().required().greater(joi.ref('startDate')),
  purpose: joi.string().optional(),
  bookedBy: joi.string().optional(),
}).min(1);

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

// GET /api/bookings
// TODO: implement per README.md section 3.
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .populate('bookedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ bookings });

  } catch (err) { next(err); }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.
export async function createBooking(req, res, next) {
  try {
    // 1. Validate payload
    const { value, error } = bookingSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const newStart = new Date(value.startDate);
    const newEnd = new Date(value.endDate);

    // Validate that start date is before end date
    if (newStart >= newEnd) {
      return res.status(400).json({ message: 'startDate must be before endDate.' });
    }

    // 2. Build conflict query filter
    const filter = {
      roomNumber: value.roomNumber,
      startDate: { $lt: newEnd },
      endDate: { $gt: newStart },
    };

    // If req.params.id exists (e.g., in update requests), exclude current booking
    if (req.params?.id) {
      filter._id = { $ne: req.params.id };
    }

    // 3. Query database
    const conflict = await Booking.findOne(filter);

    if (conflict) {
      return res.status(409).json({ message: 'Booking conflicts with an existing reservation.' });
    }

    // 4. Save new booking
    const booking = await Booking.create(value);
    return res.status(201).json(booking);

  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.
export async function updateBooking(req, res, next) {
  try {
    const bookingId = req.params.id;

    // 1. Validate payload
    const { value, error } = bookingUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    // 2. Fetch existing booking to resolve partial updates
    const existingBooking = await Booking.findById(bookingId);
    if (!existingBooking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // 3. Resolve start, end, and room (merge updates with existing data)
    const targetRoom = value.roomNumber ?? existingBooking.roomNumber;
    const targetStart = value.startDate ? new Date(value.startDate) : existingBooking.startDate;
    const targetEnd = value.endDate ? new Date(value.endDate) : existingBooking.endDate;

    if (targetStart >= targetEnd) {
      return res.status(400).json({ message: 'startDate must be before endDate.' });
    }

    // 4. Check for overlapping dates (excluding current booking)
    const conflict = await Booking.findOne({
      _id: { $ne: bookingId },
      roomNumber: targetRoom,
      startDate: { $lt: targetEnd },
      endDate: { $gt: targetStart },
    });

    if (conflict) {
      return res.status(409).json({ message: 'Updated dates conflict with an existing booking.' });
    }

    // 5. Update using findByIdAndUpdate
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { $set: value },
      { new: true, runValidators: true } // new: returns updated doc, runValidators: triggers Mongoose schema rules
    );

    return res.status(200).json(updatedBooking);

  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteBooking(req, res, next) {
  try {
    // TODO
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
