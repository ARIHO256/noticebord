"""iCalendar (.ics) generation for events."""
from icalendar import Calendar, Event as ICalEvent
from django.http import HttpResponse


def generate_event_ics(event):
    """Generate an .ics file for a single event."""
    cal = Calendar()
    cal.add("prodid", "-//Bugema University NoticeBoard//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")

    ical_event = ICalEvent()
    ical_event.add("summary", event.title)
    ical_event.add("dtstart", event.start_time)
    ical_event.add("dtend", event.end_time)
    ical_event.add("dtstamp", event.created_at)
    ical_event.add("created", event.created_at)
    ical_event.add("description", event.description)
    ical_event.add("location", event.location or "TBA")
    ical_event.add("url", f"https://noticeboard.bugema.ac.ug/events/{event.id}/")
    ical_event.add("uid", f"bugema-event-{event.id}@bugema.ac.ug")
    ical_event.add("status", "CONFIRMED")

    if event.is_recurring and event.recurring_rule:
        freq = event.recurring_rule.get("frequency", "WEEKLY").upper()
        interval = event.recurring_rule.get("interval", 1)
        ical_event.add("rrule", {"freq": freq, "interval": interval})

    cal.add_component(ical_event)
    return cal.to_ical()


def event_ics_response(event):
    """Return an HTTP response with the .ics file."""
    ics_data = generate_event_ics(event)
    response = HttpResponse(ics_data, content_type="text/calendar")
    response["Content-Disposition"] = f'attachment; filename="{event.title.replace(" ", "_")}.ics"'
    return response
