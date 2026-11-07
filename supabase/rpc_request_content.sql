-- Create an RPC to safely increment or insert a content request
CREATE OR REPLACE FUNCTION request_content(
    p_subject_id UUID,
    p_type TEXT,
    p_unit_number INTEGER DEFAULT NULL,
    p_exam_type TEXT DEFAULT NULL,
    p_exam_year INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Try to update an existing open request
    UPDATE public.content_requests
    SET request_count = request_count + 1
    WHERE subject_id = p_subject_id
      AND type = p_type
      AND (unit_number = p_unit_number OR (unit_number IS NULL AND p_unit_number IS NULL))
      AND (exam_type = p_exam_type OR (exam_type IS NULL AND p_exam_type IS NULL))
      AND (exam_year = p_exam_year OR (exam_year IS NULL AND p_exam_year IS NULL))
      AND status = 'open';

    -- If no row was updated, insert a new one
    IF NOT FOUND THEN
        INSERT INTO public.content_requests (
            subject_id, request_text, type, unit_number, exam_type, exam_year, request_count, status
        ) VALUES (
            p_subject_id,
            'Request for ' || p_type || CASE WHEN p_unit_number IS NOT NULL THEN ' Unit ' || p_unit_number ELSE '' END,
            p_type,
            p_unit_number,
            p_exam_type,
            p_exam_year,
            1,
            'open'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
