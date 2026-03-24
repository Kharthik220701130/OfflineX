package com.offlinex.notesbackend.controller;

import com.offlinex.notesbackend.model.Note;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@CrossOrigin(origins = "*")
public class NotesController {

    // In-memory store (thread-safe for single-node demo)
    private final List<Note> notes = new ArrayList<>();

    /**
     * POST /notes
     * Add a new note or update an existing one if the incoming version is newer.
     */
    @PostMapping("/notes")
    public Note upsertNote(@RequestBody Note incoming) {
        synchronized (notes) {
            for (int i = 0; i < notes.size(); i++) {
                if (notes.get(i).getId().equals(incoming.getId())) {
                    // Conflict resolution: latest updatedAt wins
                    if (incoming.getUpdatedAt() >= notes.get(i).getUpdatedAt()) {
                        notes.set(i, incoming);
                    }
                    return notes.get(i);
                }
            }
            // Note not found — add it
            notes.add(incoming);
            return incoming;
        }
    }

    /**
     * GET /notes?lastSync=<timestamp>
     * Return all notes with updatedAt > lastSync.
     * Pass lastSync=0 to get all notes.
     */
    @GetMapping("/notes")
    public List<Note> getNotes(@RequestParam(defaultValue = "0") long lastSync) {
        synchronized (notes) {
            return notes.stream()
                    .filter(n -> n.getUpdatedAt() > lastSync)
                    .collect(Collectors.toList());
        }
    }
}
