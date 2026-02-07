import { startOfDay, subDays, isAfter, isSameDay } from "date-fns";

export type DateGroup = "Today" | "Yesterday" | "Previous 7 Days" | "Previous 30 Days" | "Older";

export interface GroupedDocuments<T> {
    [key: string]: T[];
}

export function groupDocumentsByDate<T extends { created_at: string }>(documents: T[]): GroupedDocuments<T> {
    const groups: GroupedDocuments<T> = {
        "Today": [],
        "Yesterday": [],
        "Previous 7 Days": [],
        "Previous 30 Days": [],
        "Older": [],
    };

    const today = startOfDay(new Date());
    const yesterday = subDays(today, 1);
    const last7Days = subDays(today, 7);
    const last30Days = subDays(today, 30);

    documents.forEach((doc) => {
        const docDate = new Date(doc.created_at);

        if (isSameDay(docDate, today)) {
            groups["Today"].push(doc);
        } else if (isSameDay(docDate, yesterday)) {
            groups["Yesterday"].push(doc);
        } else if (isAfter(docDate, last7Days)) {
            groups["Previous 7 Days"].push(doc);
        } else if (isAfter(docDate, last30Days)) {
            groups["Previous 30 Days"].push(doc);
        } else {
            groups["Older"].push(doc);
        }
    });

    // Remove empty groups
    Object.keys(groups).forEach((key) => {
        if (groups[key].length === 0) {
            delete groups[key];
        }
    });

    return groups;
}
