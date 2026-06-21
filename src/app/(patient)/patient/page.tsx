import type { Metadata } from 'next'
import { BookingForm } from '@/components/patient/BookingForm'
import { LiveQueue }   from '@/components/patient/LiveQueue'

export const metadata: Metadata = {
  title: 'Patient Portal',
  description: 'Book your clinic token and track the live queue.',
}

export default function PatientPage() {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-mq-text-1 tracking-tight">
          Patient Portal
        </h1>
        <p className="text-xs text-mq-text-2 mt-0.5">
          Book a token with an available doctor, then watch your position in the
          live queue below.
        </p>
      </div>

      {/*
        Two-column layout on md+.
        Booking form is narrower (max ~360 px) so it sits on the left;
        queue takes the remaining width on the right.
        On mobile they stack vertically, form first.
      */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,360px)_1fr] gap-6 items-start">
        {/* Left — booking form */}
        <BookingForm />

        {/* Right — live queue */}
        <div className="bg-mq-surface border border-mq-border rounded-xl p-4 sm:p-5">
          <LiveQueue />
        </div>
      </div>
    </div>
  )
}
